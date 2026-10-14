import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import { createHash } from 'crypto';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { DocumentDoc, FindingDoc } from '../types/models';
import { ok, created } from '../utils/response';
import { NotFoundError, ConflictError, BusinessError, ValidationError } from '../utils/errors';
import { auditLog } from '../utils/audit';
import { encodeCursor, decodeCursor, sanitizeFilename } from '../utils/pagination';
import { getEnv } from '../config/env';
import { getFirebaseStorage } from '../config/firebase';

const router = Router();
router.use(requireAuth);

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_UPLOAD_BYTES = getEnv().MAX_UPLOAD_BYTES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_TYPE'));
    }
  },
});

import path from 'path';
import fs from 'fs/promises';
import { processDocumentById } from '../workers/documentWorker';

function parseObjectId(id: string): ObjectId {
  if (!id || !ObjectId.isValid(id)) {
    throw new NotFoundError();
  }
  return new ObjectId(id);
}

// ─── POST /documents/uploads ──────────────────────────────────────────────────
router.post('/documents/uploads', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) throw new ValidationError('No file provided');

  const { originalname, mimetype, size, buffer } = req.file;

  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Only PDF, JPEG, PNG allowed' }, meta: { requestId: req.requestId } });
    return;
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const db = getDb();
  const safeFilename = sanitizeFilename(originalname);
  const objectKey = `${req.auth.uid}/${Date.now()}_${sha256.slice(0, 8)}_${safeFilename}`;

  // 1. Store in local uploads directory as guaranteed local fallback
  let localFilePath: string | undefined;
  try {
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    localFilePath = path.join(uploadsDir, `${sha256.slice(0, 10)}_${safeFilename}`);
    await fs.writeFile(localFilePath, buffer);
  } catch (localErr) {
    console.warn('[documents] Local file cache write warning:', localErr);
  }

  // 2. Upload to Firebase Storage
  let uploadedToFirebase = false;
  try {
    const bucket = getFirebaseStorage();
    const fileRef = bucket.file(objectKey);
    await fileRef.save(buffer, {
      contentType: mimetype,
      metadata: { ownerId: req.auth.uid, sha256 },
    });
    uploadedToFirebase = true;
    console.log(`[documents] ☁️ Uploaded ${safeFilename} (${size} bytes) to Firebase Storage: ${objectKey}`);
  } catch (err) {
    console.warn('[documents] Firebase storage upload skipped or failed (using database & local buffer):', (err as Error).message);
  }

  // Deduplication / Update within owner
  const existing = await db.collection<DocumentDoc>('documents').findOne({
    ownerId: req.auth.uid,
    'storage.sha256': sha256,
    deletedAt: null,
  } as never);

  if (existing) {
    const existingId = existing._id!;
    // If existing document is already ready and has extracted text, return it directly
    if (existing.status === 'READY' && existing.extractedText) {
      ok(req, res, { ...existing, id: existingId.toHexString() });
      return;
    }

    // Existing document was in UPLOADING, FAILED, or missing text: update and reprocess!
    await db.collection<DocumentDoc>('documents').updateOne(
      { _id: existingId } as never,
      {
        $set: {
          name: req.body.name || existing.name || originalname,
          status: 'QUEUED',
          processingStage: 'QUEUED',
          localFilePath: localFilePath || existing.localFilePath,
          updatedAt: new Date(),
          ...((uploadedToFirebase || localFilePath) ? {} : { fileBuffer: buffer }),
        },
        ...((uploadedToFirebase || localFilePath) ? { $unset: { fileBuffer: '' } } : {}),
      }
    );

    await db.collection('processing_jobs').updateOne(
      { documentId: existingId } as never,
      {
        $set: {
          ownerId: req.auth.uid,
          documentId: existingId,
          type: 'DOCUMENT_PROCESSING',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
          errorCode: null,
          errorMessage: null,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Trigger immediate background processing
    processDocumentById(existingId).catch((err) => {
      console.warn('[documents] Immediate processing error:', err);
    });

    ok(req, res, { ...existing, status: 'QUEUED', id: existingId.toHexString() });
    return;
  }

  const documentTypeStr = (req.body.documentType as string) ?? 'OTHER';
  const validTypes = ['LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'SCAN', 'VACCINATION', 'OTHER'];
  if (!validTypes.includes(documentTypeStr)) throw new ValidationError('Invalid documentType');

  const now = new Date();
  const doc: DocumentDoc = {
    ownerId: req.auth.uid,
    name: req.body.name || originalname,
    originalFilename: safeFilename,
    documentType: documentTypeStr as DocumentDoc['documentType'],
    documentDate: req.body.documentDate ? new Date(req.body.documentDate) : undefined,
    status: 'QUEUED',
    processingStage: 'QUEUED',
    description: req.body.description,
    localFilePath,
    fileBuffer: (uploadedToFirebase || localFilePath) ? undefined : buffer,
    storage: {
      objectKey,
      contentType: mimetype,
      sizeBytes: size,
      sha256,
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const result = await db.collection<DocumentDoc>('documents').insertOne(doc as never);
  const docId = result.insertedId;

  // Enqueue processing job
  await db.collection('processing_jobs').insertOne({
    ownerId: req.auth.uid,
    documentId: docId,
    type: 'DOCUMENT_PROCESSING',
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: `doc_process_${docId.toHexString()}`,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });

  // Trigger immediate background processing
  processDocumentById(docId).catch((err) => {
    console.warn('[documents] Immediate processing error:', err);
  });

  await auditLog({
    actorUid: req.auth.uid,
    action: 'DOCUMENT_UPLOADED',
    resourceType: 'document',
    resourceId: docId.toHexString(),
    requestId: req.requestId,
    occurredAt: now,
  });

  created(req, res, { ...doc, _id: docId, id: docId.toHexString() });
});

// ─── GET /documents ────────────────────────────────────────────────────────────
const VALID_DOC_TYPES = ['LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'SCAN', 'VACCINATION', 'OTHER'];
const VALID_STATUSES = ['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'READY_WITH_WARNINGS', 'FAILED'];

router.get('/documents', async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const cursor = req.query['cursor'] as string | undefined;

  const filter: Record<string, unknown> = { ownerId: req.auth.uid, deletedAt: null };

  const type = req.query['type'] as string;
  if (type && VALID_DOC_TYPES.includes(type)) filter['documentType'] = type;

  const status = req.query['status'] as string;
  if (status && VALID_STATUSES.includes(status)) filter['status'] = status;

  const dateFrom = req.query['dateFrom'] as string;
  const dateTo = req.query['dateTo'] as string;
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter['$gte'] = new Date(dateFrom);
    if (dateTo) dateFilter['$lte'] = new Date(dateTo);
    filter['documentDate'] = dateFilter;
  }

  if (cursor) filter['_id'] = { $lt: new ObjectId(decodeCursor(cursor)) };

  const items = await db
    .collection<DocumentDoc>('documents')
    .find(filter as never, { projection: { fileBuffer: 0 } })
    .sort({ documentDate: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  ok(req, res, { items: results, nextCursor });
});

// ─── GET /documents/:id ────────────────────────────────────────────────────────
router.get('/documents/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const docId = parseObjectId(req.params['id']);
  const doc = await db.collection<DocumentDoc>('documents').findOne({
    _id: docId,
    ownerId: req.auth.uid,
    deletedAt: null,
  } as never, { projection: { fileBuffer: 0 } });
  if (!doc) throw new NotFoundError();

  const findingsCount = await db.collection<FindingDoc>('findings').countDocuments({
    documentId: doc._id,
    ownerId: req.auth.uid,
  } as never);

  ok(req, res, { ...doc, findingsCount });
});

// ─── GET /documents/:id/download ──────────────────────────────────────────────
router.get('/documents/:id/download', async (req: Request, res: Response) => {
  const db = getDb();
  const docId = parseObjectId(req.params['id']);
  const doc = await db.collection<DocumentDoc>('documents').findOne({
    _id: docId,
    ownerId: req.auth.uid,
    deletedAt: null,
    status: { $in: ['READY', 'READY_WITH_WARNINGS'] },
  } as never);

  if (!doc) throw new NotFoundError();

  let signedUrl: string | null = null;
  try {
    const bucket = getFirebaseStorage();
    const [url] = await bucket.file(doc.storage.objectKey).getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 min
    });
    signedUrl = url;
  } catch (err) {
    console.error('[documents] Failed to generate signed URL:', err);
  }

  await auditLog({
    actorUid: req.auth.uid,
    action: 'DOCUMENT_DOWNLOADED',
    resourceType: 'document',
    resourceId: doc._id!.toHexString(),
    requestId: req.requestId,
    occurredAt: new Date(),
  });

  ok(req, res, { downloadUrl: signedUrl, expiresIn: 900 });
});

// ─── DELETE /documents/:id ─────────────────────────────────────────────────────
router.delete('/documents/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const now = new Date();
  const docId = parseObjectId(req.params['id']);
  const doc = await db.collection<DocumentDoc>('documents').findOneAndUpdate(
    { _id: docId, ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: { deletedAt: now, status: 'DELETED', updatedAt: now } },
    { returnDocument: 'after' }
  );
  if (!doc) throw new NotFoundError();

  // Enqueue object purge
  await db.collection('processing_jobs').insertOne({
    ownerId: req.auth.uid,
    documentId: (doc as DocumentDoc)._id,
    type: 'OBJECT_PURGE',
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: `doc_purge_${(doc as DocumentDoc)._id!.toHexString()}`,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });

  await auditLog({
    actorUid: req.auth.uid,
    action: 'DOCUMENT_DELETED',
    resourceType: 'document',
    resourceId: (doc as DocumentDoc)._id!.toHexString(),
    requestId: req.requestId,
    occurredAt: now,
  });

  ok(req, res, { deleted: true });
});

// ─── GET /documents/:id/findings ──────────────────────────────────────────────
router.get('/documents/:id/findings', async (req: Request, res: Response) => {
  const db = getDb();
  const docId = parseObjectId(req.params['id']);

  // Verify ownership
  const docExists = await db.collection<DocumentDoc>('documents').findOne({
    _id: docId,
    ownerId: req.auth.uid,
    deletedAt: null,
  } as never);
  if (!docExists) throw new NotFoundError();

  const findings = await db
    .collection<FindingDoc>('findings')
    .find({ documentId: docId, ownerId: req.auth.uid } as never)
    .sort({ occurredAt: -1 })
    .toArray();

  ok(req, res, { items: findings });
});

// ─── POST /documents/:id/reprocess ────────────────────────────────────────────
router.post('/documents/:id/reprocess', async (req: Request, res: Response) => {
  const db = getDb();
  const docId = parseObjectId(req.params['id']);
  const doc = await db.collection<DocumentDoc>('documents').findOne({
    _id: docId,
    ownerId: req.auth.uid,
    deletedAt: null,
    status: 'FAILED',
  } as never);

  if (!doc) throw new NotFoundError();

  // Check for existing active job
  const activeJob = await db.collection('processing_jobs').findOne({
    documentId: docId,
    status: { $in: ['PENDING', 'PROCESSING'] },
  } as never);

  if (activeJob) throw new ConflictError('JOB_IN_PROGRESS', 'Processing already in progress');

  const now = new Date();
  const targetDocId = (doc as DocumentDoc)._id!;

  await db.collection('processing_jobs').updateOne(
    { idempotencyKey: `doc_process_${targetDocId.toHexString()}` } as never,
    {
      $set: { status: 'PENDING', attempts: 0, errorCode: null, updatedAt: now },
      $inc: {},
    }
  );

  // Reset document status
  await db.collection<DocumentDoc>('documents').updateOne(
    { _id: targetDocId } as never,
    { $set: { status: 'QUEUED', updatedAt: now } }
  );

  ok(req, res, { reprocessing: true });
});

// ─── GET /records (alias) ─────────────────────────────────────────────────────
router.get('/records', async (req: Request, res: Response) => {
  // Forward to documents list logic
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const filter: Record<string, unknown> = { ownerId: req.auth.uid, deletedAt: null };

  const items = await db
    .collection<DocumentDoc>('documents')
    .find(filter as never)
    .sort({ documentDate: -1 })
    .limit(limit)
    .toArray();

  ok(req, res, { items });
});

export default router;
