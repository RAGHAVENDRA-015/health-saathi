import { Router, Request, Response } from 'express';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';

import { DocumentDoc, AppointmentDoc, FindingDoc } from '../types/models';
import { ok } from '../utils/response';

const router = Router();
router.use(requireAuth);

// ─── GET /dashboard ───────────────────────────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response) => {
  const db = getDb();
  const uid = req.auth.uid;

  // Document counts by type — single aggregation
  const docCountsByType = await db
    .collection<DocumentDoc>('documents')
    .aggregate([
      { $match: { ownerId: uid, deletedAt: null } },
      { $group: { _id: '$documentType', count: { $sum: 1 } } },
    ])
    .toArray();

  const totalDocs = docCountsByType.reduce((acc, cur) => acc + (cur['count'] as number), 0);

  // Recent documents (last 5)
  const recentDocuments = await db
    .collection<DocumentDoc>('documents')
    .find({ ownerId: uid, deletedAt: null, status: { $in: ['READY', 'READY_WITH_WARNINGS'] } } as never)
    .sort({ documentDate: -1 })
    .limit(5)
    .toArray();

  // Upcoming appointments
  const upcomingAppointments = await db
    .collection<AppointmentDoc>('appointments')
    .find({ ownerId: uid, deletedAt: null, scheduledAt: { $gte: new Date() }, status: 'SCHEDULED' } as never)
    .sort({ scheduledAt: 1 })
    .limit(3)
    .toArray();

  // Active medicines count
  const activeMedicines = await db
    .collection('medicines')
    .countDocuments({ ownerId: uid, status: 'ACTIVE', deletedAt: null } as never);

  // Pending reminders
  const pendingReminders = await db
    .collection('reminders')
    .countDocuments({ ownerId: uid, enabled: true, deletedAt: null, completedAt: null } as never);

  ok(req, res, {
    documents: {
      total: totalDocs,
      byType: Object.fromEntries(docCountsByType.map((d) => [d['_id'], d['count']])),
    },
    recentDocuments,
    upcomingAppointments,
    activeMedicines,
    pendingReminders,
  });
});

// ─── GET /reports ─────────────────────────────────────────────────────────────
router.get('/reports', async (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query['limit']) || 25, 100);
  const category = req.query['category'] as string | undefined;

  const filter: Record<string, unknown> = { ownerId: req.auth.uid };
  if (category) filter['category'] = category;

  const findings = await db
    .collection<FindingDoc>('findings')
    .find(filter as never)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .toArray();

  ok(req, res, { items: findings });
});

// ─── GET /timeline ────────────────────────────────────────────────────────────
router.get('/timeline', async (req: Request, res: Response) => {
  const db = getDb();
  const uid = req.auth.uid;
  const limit = Math.min(Number(req.query['limit']) || 50, 100);
  const typeFilter = req.query['type'] as string | undefined;

  const events: Array<{ type: string; occurredAt: Date; data: unknown }> = [];

  if (!typeFilter || typeFilter === 'DOCUMENT') {
    const docs = await db
      .collection<DocumentDoc>('documents')
      .find({ ownerId: uid, deletedAt: null, status: { $in: ['READY', 'READY_WITH_WARNINGS'] } } as never)
      .sort({ documentDate: -1 })
      .limit(limit)
      .toArray();

    docs.forEach((d) => {
      events.push({
        type: 'DOCUMENT',
        occurredAt: d.documentDate ?? d.createdAt,
        data: {
          id: d._id,
          name: d.name,
          documentType: d.documentType,
          status: d.status,
          summary: d.summary,
        },
      });
    });
  }

  if (!typeFilter || typeFilter === 'APPOINTMENT') {
    const appts = await db
      .collection<AppointmentDoc>('appointments')
      .find({ ownerId: uid, deletedAt: null } as never)
      .sort({ scheduledAt: -1 })
      .limit(limit)
      .toArray();

    appts.forEach((a) => {
      events.push({
        type: 'APPOINTMENT',
        occurredAt: a.scheduledAt,
        data: {
          id: a._id,
          doctorName: a.doctorName,
          specialty: a.specialty,
          status: a.status,
          visitType: a.visitType,
        },
      });
    });
  }

  // Sort merged timeline by occurredAt desc
  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const pagedEvents = events.slice(0, limit);

  ok(req, res, { items: pagedEvents });
});

export default router;
