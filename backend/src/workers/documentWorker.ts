/**
 * HealthSaathi AI - Document Processing Worker
 *
 * Background daemon that orchestrates document processing:
 * 1. Polls for PENDING processing jobs with exponential backoff
 * 2. Updates document & job status: PROCESSING -> EXTRACTING_TEXT / RUNNING_OCR
 * 3. Downloads document file buffer from Firebase Storage
 * 4. Invokes Python OCR module (PyMuPDF for digital text, Pillow + Tesseract for scanned/image pages)
 * 5. Estimates token budget and checks constraints
 * 6. Invokes Groq LLM (llama-3.3-70b-versatile) for plain-language medical summarization
 * 7. Records actual Groq token usage and OCR performance metadata
 * 8. Extracts structured clinical findings into the findings collection
 * 9. Updates document status to READY / READY_WITH_WARNINGS, or FAILED on exhausted retries.
 *
 * Run as a separate process: npm run worker
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { ObjectId } from 'mongodb';
import { connectMongo, getDb } from '../config/mongo';
import { initFirebase, getFirebaseStorage } from '../config/firebase';
import { DocumentDoc, ProcessingJobDoc, FindingDoc } from '../types/models';
import { getGroqAdapter } from '../services/groqAdapter';
import { processDocumentWithOcr, OcrRunnerError, OcrResponse } from '../services/ocrRunner';
import { TextractService } from '../services/textractService';
import { budgetDocumentForSummarization } from '../services/tokenBudget';
import { extractClinicalFindings } from '../services/findingsExtractor';
import { classifyDocument } from '../services/documentClassifier';
import { getNotificationService } from '../services/notificationService';
import { sleep } from '../utils/pagination';

const POLL_INTERVAL_MS = 5000;
const MAX_PROCESS_BATCH = 5;

async function processObjectPurge(job: ProcessingJobDoc): Promise<void> {
  const db = getDb();
  const now = new Date();
  const docId = job.documentId;
  if (docId) {
    const doc = await db.collection<DocumentDoc>('documents').findOne({ _id: docId } as never);
    if (doc?.storage?.objectKey) {
      try {
        const bucket = getFirebaseStorage();
        await bucket.file(doc.storage.objectKey).delete({ ignoreNotFound: true });
      } catch (err) {
        console.error(`[worker] Purge storage error:`, err);
      }
    }
    await db.collection('findings').deleteMany({ documentId: docId } as never);
  }

  await db.collection<ProcessingJobDoc>('processing_jobs').updateOne(
    { _id: job._id } as never,
    { $set: { status: 'COMPLETED', finishedAt: now, updatedAt: now } }
  );
}

async function processAccountDeletion(job: ProcessingJobDoc): Promise<void> {
  const db = getDb();
  const now = new Date();
  const ownerId = job.ownerId;

  const docs = await db.collection<DocumentDoc>('documents').find({ ownerId } as never).toArray();
  const bucket = getFirebaseStorage();
  for (const doc of docs) {
    if (doc.storage?.objectKey) {
      try {
        await bucket.file(doc.storage.objectKey).delete({ ignoreNotFound: true });
      } catch {
        // ignore
      }
    }
  }

  await Promise.all([
    db.collection('users').deleteOne({ firebaseUid: ownerId } as never),
    db.collection('documents').deleteMany({ ownerId } as never),
    db.collection('findings').deleteMany({ ownerId } as never),
    db.collection('medicines').deleteMany({ ownerId } as never),
    db.collection('appointments').deleteMany({ ownerId } as never),
    db.collection('reminders').deleteMany({ ownerId } as never),
    db.collection('conversations').deleteMany({ ownerId } as never),
    db.collection('messages').deleteMany({ ownerId } as never),
  ]);

  await db.collection<ProcessingJobDoc>('processing_jobs').updateOne(
    { _id: job._id } as never,
    { $set: { status: 'COMPLETED', finishedAt: now, updatedAt: now } }
  );
  console.log(`[worker] 🗑️ Account deletion completed for user ${ownerId}`);
}

async function processJob(job: ProcessingJobDoc): Promise<void> {
  if (job.type === 'OBJECT_PURGE') {
    return processObjectPurge(job);
  }
  if (job.type === 'ACCOUNT_DELETION') {
    return processAccountDeletion(job);
  }

  const db = getDb();
  const now = new Date();
  const docId = job.documentId!;

  // 1. Mark job and document as PROCESSING with stage EXTRACTING_TEXT
  await db.collection<ProcessingJobDoc>('processing_jobs').updateOne(
    { _id: job._id } as never,
    { $set: { status: 'PROCESSING', startedAt: now, updatedAt: now } }
  );

  await db.collection<DocumentDoc>('documents').updateOne(
    { _id: docId } as never,
    { $set: { status: 'PROCESSING', processingStage: 'EXTRACTING_TEXT', updatedAt: now } }
  );

  try {
    const doc = await db.collection<DocumentDoc>('documents').findOne({ _id: docId } as never);
    if (!doc) throw new Error('Document record not found');

    // 2. Download from local cache, Firebase Cloud Storage, or database buffer
    let fileBuffer: Buffer | null = null;
    let ocrProvider = 'pymupdf_pillow_tesseract';

    if (doc.localFilePath && fs.existsSync(doc.localFilePath)) {
      try {
        fileBuffer = fs.readFileSync(doc.localFilePath);
        console.log(`[worker] 📂 Read file from local path: ${doc.localFilePath}`);
      } catch (readErr) {
        console.warn(`[worker] Failed to read from localFilePath:`, readErr);
      }
    }

    if (!fileBuffer && doc.storage?.objectKey) {
      try {
        const bucket = getFirebaseStorage();
        const [buffer] = await bucket.file(doc.storage.objectKey).download();
        fileBuffer = buffer;
        console.log(`[worker] ☁️ Downloaded file from Firebase Cloud Storage: ${doc.storage.objectKey} (${fileBuffer.length} bytes)`);
      } catch (cloudErr) {
        console.warn(`[worker] Firebase storage fetch warning:`, (cloudErr as Error).message);
      }
    }

    if (!fileBuffer && doc.fileBuffer) {
      fileBuffer = Buffer.isBuffer(doc.fileBuffer)
        ? doc.fileBuffer
        : Buffer.from((doc.fileBuffer as any).buffer || (doc.fileBuffer as any));
      console.log(`[worker] 💾 Read file directly from database buffer (${fileBuffer.length} bytes)`);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Downloaded document file is empty');
    }

    // 3. Document Extraction Pipeline (Textract + PyMuPDF / Pillow / Tesseract)
    console.log(`[worker] 📄 Processing document ${docId.toHexString()} (${doc.storage.contentType}, ${doc.storage.sizeBytes} bytes)...`);

    let ocrResponse: OcrResponse;

    // Check if Textract is explicitly configured and document is eligible (under 5MB)
    if (TextractService.isConfigured() && doc.storage.sizeBytes <= 5 * 1024 * 1024) {
      try {
        console.log(`[worker] ☁️ Invoking Amazon Textract DetectDocumentText for document ${docId.toHexString()}...`);
        ocrResponse = await TextractService.detectDocumentText(fileBuffer);
        ocrProvider = 'textract';
        console.log(`[worker] ✅ Textract extracted ${ocrResponse.metadata?.totalChars ?? 0} chars across ${ocrResponse.pageCount ?? 1} pages`);
      } catch (textractErr: unknown) {
        const te = textractErr as Error;
        console.warn(`[worker] ⚠️ Amazon Textract failed (${te.message}), falling back to local OCR pipeline...`);
        ocrResponse = await processDocumentWithOcr(fileBuffer, doc.storage.contentType);
        ocrProvider = 'pymupdf_pillow_tesseract';
      }
    } else {
      // Local pipeline: PyMuPDF for digital PDFs, Pillow + Tesseract for scanned/image pages
      ocrResponse = await processDocumentWithOcr(fileBuffer, doc.storage.contentType);
      ocrProvider = 'pymupdf_pillow_tesseract';
    }

    // If any pages were OCR'd, update stage
    if ((ocrResponse.metadata?.ocrPagesCount ?? 0) > 0) {
      await db.collection<DocumentDoc>('documents').updateOne(
        { _id: docId } as never,
        { $set: { processingStage: 'RUNNING_OCR', updatedAt: new Date() } }
      );
    }

    const extractedText = ocrResponse.extractedText ?? '';
    const ocrMeta = ocrResponse.metadata;

    console.log(
      `[worker] 🔍 Text extracted: ${ocrMeta?.totalChars ?? 0} chars, ` +
      `pages: ${ocrResponse.pageCount ?? 1} (embedded: ${ocrMeta?.embeddedPagesCount ?? 0}, ocr: ${ocrMeta?.ocrPagesCount ?? 0})`
    );

    // 4. Document Classification (medical vs non-medical)
    const classification = classifyDocument(extractedText, doc.name);
    console.log(
      `[worker] 🏷️ Document classified: ${classification.category} (isMedical: ${classification.isMedicalDocument}, confidence: ${classification.confidence})`
    );

    // 5. Update stage to GENERATING_SUMMARY
    await db.collection<DocumentDoc>('documents').updateOne(
      { _id: docId } as never,
      { $set: { processingStage: 'GENERATING_SUMMARY', updatedAt: new Date() } }
    );

    // 6. Token budgeting and formatting
    const budgeted = budgetDocumentForSummarization(extractedText, doc.name);

    // 7. Groq AI Summarization
    let summary = '';
    let docStatus: DocumentDoc['status'] = 'READY';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const groq = getGroqAdapter();
      let promptContent = budgeted.promptText;

      if (!classification.isMedicalDocument) {
        promptContent = `The following document was uploaded by a user, but it appears to be a NON-MEDICAL document (classified as ${classification.category} - ${classification.reasons.join(', ')}).
Summarize its factual contents plainly and concisely. State clearly at the top:
"Note: This document does not appear to contain clinical or medical report data."

Document Name: ${doc.name}
Extracted Text:
"""
${extractedText.slice(0, 15000)}
"""`;
      }

      const aiResult = await groq.chat([{ role: 'user', content: promptContent }]);
      summary = aiResult.content;
      promptTokens = aiResult.usage.promptTokens;
      completionTokens = aiResult.usage.completionTokens;
    } catch (aiErr: unknown) {
      const e = aiErr as Error;
      console.error('[worker] ⚠️ Groq summarization failed:', e.message);
      summary = classification.isMedicalDocument
        ? 'Document text was extracted successfully, but automated summary generation timed out. The original extracted text remains available.'
        : 'Non-clinical document processed. The original extracted text remains available.';
      docStatus = 'READY_WITH_WARNINGS';
    }

    // 8. Structured Findings Extraction (Only for medical documents!)
    const findings = classification.isMedicalDocument ? extractClinicalFindings(extractedText) : [];
    if (findings.length > 0) {
      const findingDocs: FindingDoc[] = findings.map((f) => ({
        ownerId: doc.ownerId,
        documentId: docId,
        category: f.category,
        testName: f.testName,
        result: f.result,
        unit: f.unit,
        referenceRange: f.referenceRange,
        referenceLow: f.referenceLow,
        referenceHigh: f.referenceHigh,
        status: f.status,
        occurredAt: doc.documentDate || new Date(),
        source: 'EXTRACTED',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 1,
      }));

      // Upsert findings without duplicates
      await db.collection<FindingDoc>('findings').insertMany(findingDocs as never[]);
      console.log(`[worker] 🧪 Extracted and stored ${findings.length} clinical findings`);
    }

    // 9. Update Document record with complete OCR, Classification & Token metadata
    const doneAt = new Date();
    await db.collection<DocumentDoc>('documents').updateOne(
      { _id: docId } as never,
      {
        $set: {
          status: docStatus,
          processingStage: 'COMPLETED',
          summary,
          extractedText: extractedText.slice(0, 50000), // Persist full text preview in document
          findingsCount: findings.length,
          classification: classification.category,
          isMedicalDocument: classification.isMedicalDocument,
          ocrProvider,
          processingWarnings: classification.reasons,
          isTruncated: budgeted.isTruncated,
          ocrMetadata: {
            pageCount: ocrResponse.pageCount ?? 1,
            ocrPagesCount: ocrMeta?.ocrPagesCount ?? 0,
            embeddedPagesCount: ocrMeta?.embeddedPagesCount ?? 0,
            avgConfidence: ocrMeta?.avgOcrConfidence ?? null,
            processingDurationMs: ocrMeta?.processingDurationMs ?? 0,
          },
          tokenUsage: {
            estimatedPromptTokens: budgeted.estimatedPromptTokens,
            promptTokens: promptTokens || undefined,
            completionTokens: completionTokens || undefined,
            totalTokens: promptTokens + completionTokens || undefined,
          },
          updatedAt: doneAt,
        },
        $unset: {
          fileBuffer: '', // Successfully processed — remove binary buffer from MongoDB to save RAM and storage
        },
      }
    );

    // 10. Mark job COMPLETED
    await db.collection<ProcessingJobDoc>('processing_jobs').updateOne(
      { _id: job._id } as never,
      { $set: { status: 'COMPLETED', finishedAt: doneAt, updatedAt: doneAt } }
    );

    console.log(`[worker] ✅ Document ${docId.toHexString()} finished → ${docStatus} (type: ${classification.category}, findings: ${findings.length})`);

    // 11. Send Lab Report Ready Push Notification
    try {
      await getNotificationService().notifyLabReportReady(doc.ownerId, {
        id: docId.toHexString(),
        name: doc.name || doc.originalFilename || 'Medical Document',
        findingsCount: findings.length,
      });
    } catch (notifErr) {
      console.warn(`[worker] Notification dispatch warning for ${docId.toHexString()}:`, notifErr);
    }
  } catch (err: unknown) {
    const e = err as Error;
    const isOcrError = err instanceof OcrRunnerError;
    const errorCode = isOcrError ? err.errorCode : 'PROCESSING_ERROR';

    console.error(`[worker] ❌ Error processing ${docId.toHexString()}: [${errorCode}] ${e.message}`);

    const attempts = (job.attempts ?? 0) + 1;
    const failed = attempts >= job.maxAttempts;
    const backoffMs = Math.pow(2, attempts) * 5000;
    const nextRetryAt = failed ? undefined : new Date(Date.now() + backoffMs);

    await db.collection<ProcessingJobDoc>('processing_jobs').updateOne(
      { _id: job._id } as never,
      {
        $set: {
          status: failed ? 'FAILED' : 'PENDING',
          attempts,
          errorCode,
          errorMessage: e.message,
          nextRetryAt,
          updatedAt: new Date(),
        },
      }
    );

    if (failed) {
      await db.collection<DocumentDoc>('documents').updateOne(
        { _id: docId } as never,
        {
          $set: {
            status: 'FAILED',
            processingStage: 'FAILED',
            failureCode: errorCode,
            updatedAt: new Date(),
          },
        }
      );
    }
  }
}

export async function runWorker(): Promise<void> {
  initFirebase();
  await connectMongo();

  console.log('[worker] 🏃 HealthSaathi Document Intelligence Worker started');

  while (true) {
    try {
      const db = getDb();
      const jobs = await db
        .collection<ProcessingJobDoc>('processing_jobs')
        .find({
          status: 'PENDING',
          $or: [{ nextRetryAt: { $lte: new Date() } }, { nextRetryAt: { $exists: false } }],
        } as never)
        .sort({ createdAt: 1 })
        .limit(MAX_PROCESS_BATCH)
        .toArray();

      for (const job of jobs) {
        await processJob(job);
      }
    } catch (err) {
      console.error('[worker] Poll error:', err);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

export function startWorkerDaemon(): void {
  console.log('[worker] 🏃 Document Intelligence Worker Daemon starting in background...');
  let running = true;
  (async () => {
    while (running) {
      try {
        const db = getDb();
        const jobs = await db
          .collection<ProcessingJobDoc>('processing_jobs')
          .find({
            status: 'PENDING',
            $or: [{ nextRetryAt: { $lte: new Date() } }, { nextRetryAt: { $exists: false } }],
          } as never)
          .sort({ createdAt: 1 })
          .limit(MAX_PROCESS_BATCH)
          .toArray();

        for (const job of jobs) {
          await processJob(job);
        }
      } catch (err) {
        // If DB isn't ready or disconnected, wait and retry
        console.error('[worker-daemon] Poll error:', err);
      }

      await sleep(POLL_INTERVAL_MS);
    }
  })().catch((err) => {
    console.error('[worker-daemon] Daemon stopped with error:', err);
  });
}

export async function processDocumentById(docId: ObjectId): Promise<void> {
  try {
    const db = getDb();
    const job = await db.collection<ProcessingJobDoc>('processing_jobs').findOne({ documentId: docId } as never);
    if (job) {
      await processJob(job);
    }
  } catch (err) {
    console.warn(`[worker] Immediate processing for ${docId.toHexString()} failed, daemon will retry:`, err);
  }
}

// Auto-run if executed directly
if (require.main === module) {
  runWorker().catch((err) => {
    console.error('[worker] Fatal:', err);
    process.exit(1);
  });
}

