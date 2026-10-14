import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { AppointmentDoc } from '../types/models';
import { ok, created } from '../utils/response';
import { NotFoundError, BusinessError } from '../utils/errors';
import { encodeCursor, decodeCursor } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const appointmentSchema = z.object({
  doctorName: z.string().min(1).max(200),
  specialty: z.string().max(100).optional(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1).max(50),
  location: z.string().max(300).optional(),
  visitType: z.enum(['IN_PERSON', 'TELEMEDICINE', 'HOME_VISIT']).default('IN_PERSON'),
  notes: z.string().max(1000).optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).default('SCHEDULED'),
});

// GET /appointments
router.get('/appointments', async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const cursor = req.query['cursor'] as string | undefined;
  const status = req.query['status'] as string | undefined;

  const filter: Record<string, unknown> = { ownerId: req.auth.uid, deletedAt: null };
  if (status) filter['status'] = status;
  if (cursor) filter['_id'] = { $lt: new ObjectId(decodeCursor(cursor)) };

  const items = await db
    .collection<AppointmentDoc>('appointments')
    .find(filter as never)
    .sort({ scheduledAt: 1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeCursor(results[results.length - 1]._id!.toHexString()) : undefined;

  ok(req, res, { items: results, nextCursor });
});

// POST /appointments
router.post('/appointments', async (req: Request, res: Response) => {
  const body = appointmentSchema.parse(req.body);
  const scheduledAt = new Date(body.scheduledAt);

  // Reject new appointments in the past
  if (body.status === 'SCHEDULED' && scheduledAt < new Date()) {
    throw new BusinessError('PAST_APPOINTMENT', 'Cannot schedule a new appointment in the past');
  }

  const db = getDb();
  const now = new Date();

  const doc: AppointmentDoc = {
    ownerId: req.auth.uid,
    doctorName: body.doctorName,
    specialty: body.specialty,
    scheduledAt,
    timezone: body.timezone,
    location: body.location,
    visitType: body.visitType,
    notes: body.notes,
    status: body.status,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const result = await db.collection<AppointmentDoc>('appointments').insertOne(doc as never);
  created(req, res, { ...doc, _id: result.insertedId });
});

// GET /appointments/:id
router.get('/appointments/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const doc = await db.collection<AppointmentDoc>('appointments').findOne({
    _id: new ObjectId(req.params['id']),
    ownerId: req.auth.uid,
    deletedAt: null,
  } as never);
  if (!doc) throw new NotFoundError();
  ok(req, res, doc);
});

// PATCH /appointments/:id
router.patch('/appointments/:id', async (req: Request, res: Response) => {
  const body = appointmentSchema.partial().parse(req.body);
  const db = getDb();
  const now = new Date();

  if (body.scheduledAt && body.status === 'SCHEDULED') {
    const scheduledAt = new Date(body.scheduledAt);
    if (scheduledAt < now) {
      throw new BusinessError('PAST_APPOINTMENT', 'Cannot reschedule to a past date');
    }
  }

  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (body.doctorName !== undefined) updateFields['doctorName'] = body.doctorName;
  if (body.specialty !== undefined) updateFields['specialty'] = body.specialty;
  if (body.scheduledAt !== undefined) updateFields['scheduledAt'] = new Date(body.scheduledAt);
  if (body.timezone !== undefined) updateFields['timezone'] = body.timezone;
  if (body.location !== undefined) updateFields['location'] = body.location;
  if (body.visitType !== undefined) updateFields['visitType'] = body.visitType;
  if (body.notes !== undefined) updateFields['notes'] = body.notes;
  if (body.status !== undefined) updateFields['status'] = body.status;

  const result = await db.collection<AppointmentDoc>('appointments').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError();
  ok(req, res, result);
});

// DELETE /appointments/:id
router.delete('/appointments/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const result = await db.collection<AppointmentDoc>('appointments').findOneAndUpdate(
    { _id: new ObjectId(req.params['id']), ownerId: req.auth.uid, deletedAt: null } as never,
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError();
  ok(req, res, { deleted: true });
});

export default router;
