import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { ConversationDoc, MessageDoc, DocumentDoc, FindingDoc, MedicineDoc } from '../types/models';
import { ok, created } from '../utils/response';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';
import { getGroqAdapter } from '../services/groqAdapter';
import { auditLog } from '../utils/audit';
import { encodeCursor, decodeCursor } from '../utils/pagination';
import { getEnv } from '../config/env';
import { processDocumentById } from '../workers/documentWorker';
import { getMemoryService } from '../services/memoryService';

const router = Router();
router.use(requireAuth);

const conversationPaths = ['/copilot/conversations', '/conversations'];
const conversationIdPaths = ['/copilot/conversations/:id', '/conversations/:id'];
const conversationMessagesPaths = ['/copilot/conversations/:id/messages', '/conversations/:id/messages'];

/**
 * Strips markdown formatting syntax (asterisks, bold, headers, blockquotes, links)
 * to produce clean plain-text conversation previews without raw markdown characters.
 */
function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^[\s]*[-+*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── POST /copilot/conversations ──────────────────────────────────────────────
router.post(conversationPaths, async (req: Request, res: Response) => {
  const body = z
    .object({
      title: z.string().max(200).optional(),
      sourceDocumentId: z.string().optional(),
    })
    .parse(req.body);

  const db = getDb();
  const sourceDocumentIds: ObjectId[] = [];

  if (body.sourceDocumentId && ObjectId.isValid(body.sourceDocumentId)) {
    const doc = await db.collection<DocumentDoc>('documents').findOne({
      _id: new ObjectId(body.sourceDocumentId),
      ownerId: req.auth.uid,
      deletedAt: null,
    } as never);
    if (doc) {
      sourceDocumentIds.push(new ObjectId(body.sourceDocumentId));
    }
  }

  const now = new Date();
  const conv: ConversationDoc = {
    ownerId: req.auth.uid,
    title: body.title || 'New Consultation',
    sourceDocumentIds,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    deletedAt: null as never,
    schemaVersion: 1,
  };

  const result = await db.collection<ConversationDoc>('conversations').insertOne(conv as never);
  created(req, res, { ...conv, _id: result.insertedId, id: result.insertedId.toHexString() });
});

// ─── GET /copilot/conversations ───────────────────────────────────────────────
router.get(conversationPaths, async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const cursor = req.query['cursor'] as string | undefined;

  const filter: Record<string, unknown> = {
    ownerId: req.auth.uid,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
  if (cursor) filter['_id'] = { $lt: new ObjectId(decodeCursor(cursor)) };

  const items = await db
    .collection<ConversationDoc>('conversations')
    .find(filter as never)
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  const formattedResults = results.map((c) => ({
    ...c,
    id: c._id!.toHexString(),
    lastMessagePreview: c.lastMessagePreview ? stripMarkdown(c.lastMessagePreview) : undefined,
  }));

  ok(req, res, { items: formattedResults, nextCursor });
});

// ─── GET /copilot/conversations/:id/messages ──────────────────────────────────
router.get(conversationMessagesPaths, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params['id'])) throw new NotFoundError('Invalid conversation ID');
  const db = getDb();
  const convIdObj = new ObjectId(req.params['id']);
  const uid = req.auth.uid;

  const limit = Math.min(Number(req.query['limit']) || 50, 100);
  const cursor = req.query['cursor'] as string | undefined;

  const filter: Record<string, unknown> = {
    conversationId: convIdObj,
    ownerId: uid,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
  if (cursor) filter['_id'] = { $gt: new ObjectId(decodeCursor(cursor)) };

  // Run conversation ownership check and messages query in parallel for lowest latency
  const [conv, items] = await Promise.all([
    db.collection<ConversationDoc>('conversations').findOne(
      {
        _id: convIdObj,
        ownerId: uid,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      } as never,
      { projection: { _id: 1 } }
    ),
    db.collection<MessageDoc>('messages')
      .find(filter as never)
      .sort({ createdAt: 1 })
      .limit(limit + 1)
      .toArray(),
  ]);

  if (!conv) throw new NotFoundError('Conversation not found');

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  const formattedResults = results.map((m) => ({
    ...m,
    id: m._id!.toHexString(),
  }));

  ok(req, res, { items: formattedResults, nextCursor });
});

// ─── POST /copilot/conversations/:id/messages ─────────────────────────────────
router.post(conversationMessagesPaths, async (req: Request, res: Response) => {
  const env = getEnv();
  const body = z
    .object({
      content: z.string().min(1).max(4000),
      sourceDocumentId: z.string().optional(),
      context: z.string().max(50000).optional(),
      language: z.enum(['en', 'te', 'hi']).optional(),
    })
    .parse(req.body);

  const db = getDb();
  const uid = req.auth.uid;
  const now = new Date();
  const rawId = req.params['id'];

  // Retrieve user's verified language preference from database
  const userProfile = await db.collection('users').findOne(
    { firebaseUid: uid },
    { projection: { preferences: 1, preferredLanguage: 1 } }
  );
  const trustedUserLanguage = (body.language || userProfile?.preferences?.language || userProfile?.preferences?.preferredLanguage || userProfile?.preferredLanguage || 'en') as string;

  let conv: ConversationDoc | null = null;
  if (ObjectId.isValid(rawId) && rawId !== 'default' && rawId !== 'new') {
    conv = await db.collection<ConversationDoc>('conversations').findOne({
      _id: new ObjectId(rawId),
      ownerId: uid,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    } as never);
  }

  if (!conv) {
    // Automatically create/resume a conversation for this user
    const titleCandidate = body.content.replace(/\s+/g, ' ').trim().slice(0, 50);
    const newConv: ConversationDoc = {
      ownerId: uid,
      title: titleCandidate || 'Health Consultation',
      sourceDocumentIds: [],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      deletedAt: null as never,
      schemaVersion: 1,
    };
    const insertRes = await db.collection<ConversationDoc>('conversations').insertOne(newConv as never);
    conv = { ...newConv, _id: insertRes.insertedId };
  }

  const convId = conv._id!;

  // Check emergency guardrails FIRST — never call AI or wait for database on emergency patterns
  const groq = getGroqAdapter();
  const emergencyResponse = groq.checkEmergency(body.content, trustedUserLanguage);

  if (emergencyResponse) {
    const userMsg: MessageDoc = {
      ownerId: uid,
      conversationId: convId,
      role: 'user',
      content: body.content,
      sourceDocumentIds: [],
      safety: { triggered: true, category: 'EMERGENCY' },
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    const assistantMsg: MessageDoc = {
      ownerId: uid,
      conversationId: convId,
      role: 'assistant',
      content: emergencyResponse,
      sourceDocumentIds: [],
      safety: { triggered: true, category: 'EMERGENCY' },
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    const emergencyPreview = stripMarkdown(emergencyResponse).slice(0, 140);
    const [insertedUser, insertedAssistant] = await Promise.all([
      db.collection<MessageDoc>('messages').insertOne(userMsg as never),
      db.collection<MessageDoc>('messages').insertOne(assistantMsg as never),
      db.collection<ConversationDoc>('conversations').updateOne(
        { _id: convId } as never,
        {
          $set: {
            lastMessageAt: now,
            updatedAt: now,
            lastMessagePreview: emergencyPreview,
            ...(conv.title ? {} : { title: body.content.replace(/\s+/g, ' ').trim().slice(0, 50) }),
          },
        }
      ),
      auditLog({
        actorUid: uid,
        action: 'COPILOT_EMERGENCY_TRIGGERED',
        resourceType: 'conversation',
        resourceId: convId.toHexString(),
        requestId: req.requestId,
        occurredAt: now,
      }),
    ]);

    ok(req, res, {
      message: {
        ...assistantMsg,
        _id: insertedAssistant.insertedId,
        id: insertedAssistant.insertedId.toHexString(),
      },
      conversationId: convId.toHexString(),
      emergencyTriggered: true,
    });
    return;
  }

  // Common background tasks executed concurrently to maximize throughput
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const quotaPromise = db.collection<MessageDoc>('messages').countDocuments({
    ownerId: uid,
    role: 'user',
    createdAt: { $gte: today },
  } as never);

  const historyPromise = db
    .collection<MessageDoc>('messages')
    .find({
      conversationId: convId,
      ownerId: uid,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    } as never)
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const memoryService = getMemoryService();
  const memoryPromise = memoryService.getClinicalMemoriesContext(uid);

  // Gather authorized record context (strictly user's own data, never demo_user_001)
  let contextText = '';
  const contextDocIds: ObjectId[] = [];

  const contextDocId = body.sourceDocumentId
    ? body.sourceDocumentId
    : conv.sourceDocumentIds[0]?.toHexString();

  let history: MessageDoc[] = [];

  if (contextDocId) {
    const docQueryPromise = ObjectId.isValid(contextDocId)
      ? db.collection<DocumentDoc>('documents').findOne({
          _id: new ObjectId(contextDocId),
          ownerId: uid,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        } as never)
      : db.collection<DocumentDoc>('documents').findOne({
          ownerId: uid,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
          name: new RegExp(contextDocId.replace(/[-_]/g, ' ').replace(/^doc\s*/i, ''), 'i'),
        } as never);

    const [todayMessageCount, contextDoc, memoryContext, fetchedHistory] = await Promise.all([
      quotaPromise,
      docQueryPromise,
      memoryPromise,
      historyPromise,
    ]);

    if (todayMessageCount >= env.COPILOT_DAILY_MESSAGE_LIMIT) {
      throw new AppError(429, 'DAILY_QUOTA_EXCEEDED', 'Daily message limit reached. Please try again tomorrow.');
    }
    history = fetchedHistory;

    if (contextDoc) {
      contextDocIds.push(contextDoc._id!);

      if (contextDoc.status === 'QUEUED' || contextDoc.status === 'PROCESSING' || contextDoc.status === 'UPLOADING') {
        if (contextDoc.fileBuffer) {
          processDocumentById(contextDoc._id!).catch(() => {});
        }
        if (contextDoc.status === 'UPLOADING' && !contextDoc.fileBuffer && !contextDoc.extractedText) {
          contextText = `Selected Document: "${contextDoc.name}"
Status: Incomplete upload.
Note: The document file upload was interrupted before processing could begin. Kindly advise the user to re-upload or re-attach the document using the chat (+) attach button or upload page so it can be analyzed.`;
        } else {
          contextText = `Selected Document: "${contextDoc.name}"
Status: Processing in progress (Stage: ${contextDoc.processingStage || 'EXTRACTING_TEXT'}).
Note: This document is currently being analyzed by the OCR and text extraction engine. The complete text is not yet available. If the user asks about this document, kindly inform them that it is still being processed and will be ready shortly.`;
        }
      } else if (contextDoc.status === 'FAILED') {
        contextText = `Selected Document: "${contextDoc.name}"
Status: Processing failed (Failure Code: ${contextDoc.failureCode || 'UNKNOWN_ERROR'}).
Note: Text extraction or OCR failed for this document. If the user asks about this document, inform them that processing could not be completed and suggest re-uploading a clearer PDF or image.`;
      } else {
        const isMedical = contextDoc.isMedicalDocument !== false;
        const classification = contextDoc.classification || (isMedical ? 'MEDICAL_REPORT' : 'OTHER');
        const textSample = (contextDoc.extractedText || '').trim().slice(0, 10000);

        if (!textSample && !contextDoc.summary) {
          contextText = `Selected Document: "${contextDoc.name}"
Status: Processing text extraction.
Note: The document file is registered, but text extraction has not finished. Please inform the user that this document is being processed and suggest asking again in a few seconds.`;
        } else if (!isMedical) {
          contextText = `Selected Document: "${contextDoc.name}"
Document Type / Classification: NON-MEDICAL DOCUMENT (${classification})
Warning / Note: This document has been classified as non-medical (${(contextDoc.processingWarnings || []).join(', ') || 'No clinical indicators found'}). It does NOT contain medical lab reports, blood tests, or diagnostic findings.
Assistant Instruction: Answer the user's questions strictly using the extracted text below. Explicitly clarify to the user that this is a non-clinical document if they ask about health or medical implications. Do NOT invent or hallucinate blood test values, biomarkers, or medical conditions.

Extracted Document Content:
"""
${textSample || contextDoc.summary || 'No text extracted from document.'}
"""`;
        } else {
          const docFindings = await db
            .collection<FindingDoc>('findings')
            .find({ documentId: contextDoc._id, ownerId: uid } as never)
            .limit(40)
            .toArray();

          const findingLines = docFindings
            .map((f) => `  - ${f.testName}: ${f.result}${f.unit ? ' ' + f.unit : ''} (ref: ${f.referenceRange ?? 'N/A'}) [Status: ${f.status}]`)
            .join('\n');

          contextText = `Selected Document: "${contextDoc.name}" (${contextDoc.documentType || classification}, Date: ${contextDoc.documentDate?.toISOString().split('T')[0] ?? 'date unknown'})
Clinical Summary: ${contextDoc.summary ?? 'N/A'}

Structured Lab / Clinical Findings:
${findingLines || 'No structured lab findings extracted.'}

Raw Extracted Document Text:
"""
${textSample || 'No additional raw text available.'}
"""`;
        }
      }
    } else {
      contextText = `Note: The requested document identifier "${contextDocId}" could not be found in your uploaded records. Please answer general health questions or ask the user to verify the document name.`;
    }

    if (memoryContext) {
      contextText = memoryContext + (contextText ? '\n\n' + contextText : '');
    }
  } else {
    // General query: fetch all user documents, lab findings, medicines, memory, history, and quota concurrently
    const [
      todayMessageCount,
      allDocs,
      allFindings,
      activeMeds,
      memoryContext,
      fetchedHistory,
    ] = await Promise.all([
      quotaPromise,
      db.collection<DocumentDoc>('documents')
        .find({
          ownerId: uid,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
          status: { $in: ['READY', 'READY_WITH_WARNINGS'] },
        } as never)
        .sort({ documentDate: -1 })
        .limit(5)
        .toArray(),
      db.collection<FindingDoc>('findings')
        .find({ ownerId: uid } as never)
        .sort({ occurredAt: -1 })
        .limit(40)
        .toArray(),
      db.collection<MedicineDoc>('medicines')
        .find({ ownerId: uid, status: 'ACTIVE', deletedAt: null } as never)
        .limit(5)
        .toArray(),
      memoryPromise,
      historyPromise,
    ]);

    if (todayMessageCount >= env.COPILOT_DAILY_MESSAGE_LIMIT) {
      throw new AppError(429, 'DAILY_QUOTA_EXCEEDED', 'Daily message limit reached. Please try again tomorrow.');
    }
    history = fetchedHistory;

    if (allDocs.length > 0) {
      const findingsByDoc = new Map<string, string[]>();
      for (const f of allFindings) {
        const key = f.documentId?.toHexString() || 'general';
        const list = findingsByDoc.get(key) || [];
        list.push(`    * ${f.testName}: ${f.result}${f.unit ? ' ' + f.unit : ''} (ref: ${f.referenceRange ?? 'N/A'}) [${f.status}]`);
        findingsByDoc.set(key, list);
      }

      const docSummaries = allDocs.map((doc) => {
        if (doc.name && body.content.toLowerCase().includes(doc.name.toLowerCase())) {
          contextDocIds.push(doc._id!);
        }
        const docFindings = findingsByDoc.get(doc._id!.toHexString()) || [];
        return `• Document: "${doc.name}" (${doc.classification || doc.documentType}, Date: ${doc.documentDate?.toISOString().split('T')[0] ?? 'N/A'})\n  Summary: ${doc.summary ?? 'N/A'}\n  Biomarkers & Findings:\n${docFindings.join('\n') || '    * No specific lab findings'}`;
      }).join('\n\n');

      contextText = `Patient Medical Records on File:\n\n${docSummaries}`;
    }

    if (activeMeds.length > 0) {
      const medLines = activeMeds.map((m) => `  - ${m.name}${m.strength ? ' ' + m.strength : ''}: ${m.timing || m.frequency || 'Daily'} (${m.notes || 'Active'})`).join('\n');
      contextText += `${contextText ? '\n\n' : ''}Active Prescriptions & Regimen:\n${medLines}`;
    }

    if (memoryContext) {
      contextText = memoryContext + (contextText ? '\n\n' + contextText : '');
    }

    if (!contextText) {
      contextText = `Patient Profile: No medical records or active prescriptions currently on file. Answer user questions with general health knowledge and encourage consulting a doctor or uploading records for personalized analysis.`;
    }
  }

  if (body.context && !contextDocId) {
    contextText = body.context + (contextText ? '\n\n' + contextText : '');
  }

  history.reverse();
  const historyMessages = history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  historyMessages.push({ role: 'user', content: body.content });

  // Call Groq
  let aiResult: Awaited<ReturnType<typeof groq.chat>>;
  try {
    aiResult = await groq.chat(historyMessages, contextText || undefined, trustedUserLanguage);
  } catch (err: unknown) {
    const e = err as Error;
    await auditLog({
      actorUid: uid,
      action: 'COPILOT_AI_ERROR',
      resourceType: 'conversation',
      resourceId: convId.toHexString(),
      requestId: req.requestId,
      metadata: { error: e.message },
      occurredAt: new Date(),
    });
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      'The AI Copilot (GPT-OSS 120B) is momentarily taking longer to respond or experiencing high demand. Please try asking again in a moment.'
    );
  }

  // Persist user + assistant messages and update conversation concurrently
  const userMsg: MessageDoc = {
    ownerId: uid,
    conversationId: convId,
    role: 'user',
    content: body.content,
    sourceDocumentIds: contextDocIds,
    safety: { triggered: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null as never,
    schemaVersion: 1,
  };

  const assistantMsg: MessageDoc = {
    ownerId: uid,
    conversationId: convId,
    role: 'assistant',
    content: aiResult.content,
    sourceDocumentIds: contextDocIds,
    model: aiResult.model,
    usage: aiResult.usage,
    providerRequestId: aiResult.providerRequestId,
    safety: { triggered: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as never,
    schemaVersion: 1,
  };

  const preview = stripMarkdown(aiResult.content).slice(0, 140);
  const titleCandidate = body.content.replace(/\s+/g, ' ').trim().slice(0, 50);

  const [insertedUser, insertedAssistant] = await Promise.all([
    db.collection<MessageDoc>('messages').insertOne(userMsg as never),
    db.collection<MessageDoc>('messages').insertOne(assistantMsg as never),
    db.collection<ConversationDoc>('conversations').updateOne(
      { _id: convId } as never,
      {
        $set: {
          lastMessageAt: new Date(),
          updatedAt: new Date(),
          lastMessagePreview: preview,
          ...(conv.title && conv.title !== 'New Consultation' ? {} : { title: titleCandidate }),
        },
      }
    ),
    auditLog({
      actorUid: uid,
      action: 'COPILOT_MESSAGE_SENT',
      resourceType: 'conversation',
      resourceId: convId.toHexString(),
      requestId: req.requestId,
      metadata: { model: aiResult.model, promptTokens: aiResult.usage.promptTokens },
      occurredAt: now,
    }),
  ]);

  // Asynchronously extract and persist durable clinical health facts for patient or family (silent & non-blocking)
  memoryService.extractAndPersistMemories(uid, convId, body.content, aiResult.content).catch((memErr) => {
    console.warn('[copilot] Asynchronous memory extraction warning:', memErr);
  });

  ok(req, res, {
    message: {
      ...assistantMsg,
      _id: insertedAssistant.insertedId,
      id: insertedAssistant.insertedId.toHexString(),
      sourceDocumentIds: contextDocIds.map((id) => id.toHexString()),
    },
    conversationId: convId.toHexString(),
    usage: aiResult.usage,
  });
});

// ─── GET /copilot/memories ────────────────────────────────────────────────────
router.get(['/copilot/memories', '/memories'], async (req: Request, res: Response) => {
  const memoryService = getMemoryService();
  const items = await memoryService.listMemories(req.auth.uid);
  ok(req, res, { items });
});

// ─── DELETE /copilot/memories/:id ─────────────────────────────────────────────
router.delete(['/copilot/memories/:id', '/memories/:id'], async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params['id'])) throw new NotFoundError('Invalid memory ID');
  const memoryService = getMemoryService();
  const success = await memoryService.deleteMemory(req.auth.uid, new ObjectId(req.params['id']));
  if (!success) throw new NotFoundError('Memory not found');
  ok(req, res, { deleted: true });
});

// ─── PATCH /copilot/conversations/:id ────────────────────────────────────────
router.patch(conversationIdPaths, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params['id'])) throw new NotFoundError('Invalid conversation ID');
  const body = z
    .object({
      title: z.string().trim().min(1).max(200),
    })
    .parse(req.body);

  const db = getDb();
  const convId = new ObjectId(req.params['id']);

  const result = await db.collection<ConversationDoc>('conversations').findOneAndUpdate(
    { _id: convId, ownerId: req.auth.uid, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] } as never,
    { $set: { title: body.title, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('Conversation not found');

  ok(req, res, {
    ...result,
    id: result._id!.toHexString(),
  });
});

// ─── DELETE /copilot/conversations/:id ───────────────────────────────────────
router.delete(conversationIdPaths, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params['id'])) throw new NotFoundError('Invalid conversation ID');
  const db = getDb();
  const convId = new ObjectId(req.params['id']);
  const now = new Date();

  const result = await db.collection<ConversationDoc>('conversations').findOneAndUpdate(
    { _id: convId, ownerId: req.auth.uid, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] } as never,
    { $set: { deletedAt: now, updatedAt: now } },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('Conversation not found');

  // Cascade soft-delete to messages belonging to this conversation
  await db.collection<MessageDoc>('messages').updateMany(
    { conversationId: convId, ownerId: req.auth.uid, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] } as never,
    { $set: { deletedAt: now, updatedAt: now } }
  );

  await auditLog({
    actorUid: req.auth.uid,
    action: 'COPILOT_CONVERSATION_DELETED',
    resourceType: 'conversation',
    resourceId: convId.toHexString(),
    requestId: req.requestId,
    occurredAt: now,
  });

  ok(req, res, { deleted: true });
});

export default router;
