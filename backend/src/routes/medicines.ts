import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { MedicineDoc, MedicineStatus } from '../types/models';
import { ok, created } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { encodeCursor, decodeCursor } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUSES: MedicineStatus[] = ['ACTIVE', 'COMPLETED', 'PAUSED', 'DISCONTINUED'];

const medicineSchema = z.object({
  name: z.string().min(1).max(200),
  strength: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  timing: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'DISCONTINUED']).default('ACTIVE'),
  notes: z.string().max(1000).optional(),
});

// GET /medicines
router.get('/medicines', async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const cursor = req.query['cursor'] as string | undefined;
  const status = req.query['status'] as string | undefined;

  const filter: Record<string, unknown> = {
    ownerId: req.auth.uid,
    deletedAt: null,
  };
  if (status && ALLOWED_STATUSES.includes(status as MedicineStatus)) {
    filter['status'] = status;
  }
  if (cursor) {
    filter['_id'] = { $lt: new ObjectId(decodeCursor(cursor)) };
  }

  const items = await db
    .collection<MedicineDoc>('medicines')
    .find(filter as never)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  ok(req, res, { items: results, nextCursor });
});

// POST /medicines
router.post('/medicines', async (req: Request, res: Response) => {
  const body = medicineSchema.parse(req.body);
  const db = getDb();
  const now = new Date();

  const doc: MedicineDoc = {
    ownerId: req.auth.uid,
    name: body.name,
    strength: body.strength,
    frequency: body.frequency,
    timing: body.timing,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    status: body.status,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const result = await db.collection<MedicineDoc>('medicines').insertOne(doc as never);
  created(req, res, { ...doc, _id: result.insertedId });
});

// GET /medicines/:id
router.get('/medicines/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const doc = await db.collection<MedicineDoc>('medicines').findOne({
    _id: new ObjectId(req.params['id']),
    ownerId: req.auth.uid,
    deletedAt: null,
  } as never);
  if (!doc) throw new NotFoundError();
  ok(req, res, doc);
});

// PATCH /medicines/:id
const patchMedicineSchema = medicineSchema.partial();

router.patch('/medicines/:id', async (req: Request, res: Response) => {
  const body = patchMedicineSchema.parse(req.body);
  const db = getDb();
  const now = new Date();

  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updateFields['name'] = body.name;
  if (body.strength !== undefined) updateFields['strength'] = body.strength;
  if (body.frequency !== undefined) updateFields['frequency'] = body.frequency;
  if (body.timing !== undefined) updateFields['timing'] = body.timing;
  if (body.startDate !== undefined) updateFields['startDate'] = new Date(body.startDate);
  if (body.endDate !== undefined) updateFields['endDate'] = new Date(body.endDate);
  if (body.status !== undefined) updateFields['status'] = body.status;
  if (body.notes !== undefined) updateFields['notes'] = body.notes;

  const result = await db.collection<MedicineDoc>('medicines').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError();
  ok(req, res, result);
});

// DELETE /medicines/:id
router.delete('/medicines/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const result = await db.collection<MedicineDoc>('medicines').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError();
  ok(req, res, { deleted: true });
});

export default router;
