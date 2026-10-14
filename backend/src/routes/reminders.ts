import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { ReminderDoc } from '../types/models';
import { ok, created } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { encodeCursor, decodeCursor } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const reminderSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(['MEDICINE', 'APPOINTMENT', 'GENERAL', 'TEST']).default('GENERAL'),
  scheduledAtLocal: z.string().min(1),
  timezone: z.string().min(1).max(50),
  repeat: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('ONCE'),
  enabled: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

// GET /reminders
router.get('/reminders', async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const cursor = req.query['cursor'] as string | undefined;
  const enabled = req.query['enabled'];

  const filter: Record<string, unknown> = { ownerId: req.auth.uid, deletedAt: null };
  if (enabled === 'true') filter['enabled'] = true;
  if (enabled === 'false') filter['enabled'] = false;
  if (cursor) filter['_id'] = { $lt: new ObjectId(decodeCursor(cursor)) };

  const items = await db
    .collection<ReminderDoc>('reminders')
    .find(filter as never)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  ok(req, res, { items: results, nextCursor });
});

// POST /reminders
router.post('/reminders', async (req: Request, res: Response) => {
  const body = reminderSchema.parse(req.body);
  const db = getDb();
  const now = new Date();

  const doc: ReminderDoc = {
    ownerId: req.auth.uid,
    title: body.title,
    category: body.category,
    scheduledAtLocal: body.scheduledAtLocal,
    timezone: body.timezone,
    repeat: body.repeat,
    enabled: body.enabled,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const result = await db.collection<ReminderDoc>('reminders').insertOne(doc as never);
  created(req, res, { ...doc, _id: result.insertedId });
});

// GET /reminders/:id
router.get('/reminders/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const doc = await db.collection<ReminderDoc>('reminders').findOne({
    _id: new ObjectId(req.params['id']),
    ownerId: req.auth.uid,
    deletedAt: null,
  } as never);
  if (!doc) throw new NotFoundError();
  ok(req, res, doc);
});

// PATCH /reminders/:id
router.patch('/reminders/:id', async (req: Request, res: Response) => {
  const body = reminderSchema.partial().parse(req.body);
  const db = getDb();
  const now = new Date();

  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (body.title !== undefined) updateFields['title'] = body.title;
  if (body.category !== undefined) updateFields['category'] = body.category;
  if (body.scheduledAtLocal !== undefined) updateFields['scheduledAtLocal'] = body.scheduledAtLocal;
  if (body.timezone !== undefined) updateFields['timezone'] = body.timezone;
  if (body.repeat !== undefined) updateFields['repeat'] = body.repeat;
  if (body.enabled !== undefined) updateFields['enabled'] = body.enabled;
  if (body.notes !== undefined) updateFields['notes'] = body.notes;

  const result = await db.collection<ReminderDoc>('reminders').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError();
  ok(req, res, result);
});

// POST /reminders/:id/complete
router.post('/reminders/:id/complete', async (req: Request, res: Response) => {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<ReminderDoc>('reminders').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: { completedAt: now, enabled: false, updatedAt: now } },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError();
  ok(req, res, result);
});

// DELETE /reminders/:id
router.delete('/reminders/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const result = await db.collection<ReminderDoc>('reminders').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError();
  ok(req, res, { deleted: true });
});

export default router;
