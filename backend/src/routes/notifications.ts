import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getNotificationService } from '../services/notificationService';
import { ok, created } from '../utils/response';
import { ValidationError } from '../utils/errors';

const router = Router();
router.use(requireAuth);

const fcmTokenSchema = z.object({
  token: z.string().min(1).max(1000),
});

const triggerTestSchema = z.object({
  type: z.enum(['MEDICINE_SCHEDULE', 'APPOINTMENT_REMINDER', 'LAB_REPORT_READY']),
  medicineName: z.string().optional(),
  strength: z.string().optional(),
  timing: z.string().optional(),
  doctorName: z.string().optional(),
  specialty: z.string().optional(),
  hoursAhead: z.number().optional(),
  documentName: z.string().optional(),
  findingsCount: z.number().optional(),
});

// ─── POST /notifications/fcm-token ───────────────────────────────────────────
router.post('/notifications/fcm-token', async (req: Request, res: Response) => {
  const body = fcmTokenSchema.parse(req.body);
  await getNotificationService().registerFcmToken(req.auth.uid, body.token);
  ok(req, res, { message: 'FCM push token registered successfully' });
});

// ─── GET /notifications ───────────────────────────────────────────────────────
router.get('/notifications', async (req: Request, res: Response) => {
  const unreadOnly = req.query['unreadOnly'] === 'true';
  const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
  const since = req.query['since'] ? new Date(String(req.query['since'])) : undefined;

  const result = await getNotificationService().getUserNotifications(req.auth.uid, {
    unreadOnly,
    limit,
    since,
  });

  ok(req, res, result);
});

// ─── POST /notifications/:id/read ────────────────────────────────────────────
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  const { id } = req.params;
  const success = await getNotificationService().markAsRead(req.auth.uid, id);
  ok(req, res, { success });
});

// ─── POST /notifications/read-all ────────────────────────────────────────────
router.post('/notifications/read-all', async (req: Request, res: Response) => {
  const updatedCount = await getNotificationService().markAllAsRead(req.auth.uid);
  ok(req, res, { updatedCount });
});

// ─── POST /notifications/trigger-test ─────────────────────────────────────────
router.post('/notifications/trigger-test', async (req: Request, res: Response) => {
  const body = triggerTestSchema.parse(req.body);
  const notifService = getNotificationService();

  let result;
  if (body.type === 'MEDICINE_SCHEDULE') {
    result = await notifService.notifyMedicineSchedule(req.auth.uid, {
      name: body.medicineName || 'Metformin 500mg',
      strength: body.strength || '500 mg',
      timing: body.timing || 'Morning after breakfast',
    });
  } else if (body.type === 'APPOINTMENT_REMINDER') {
    result = await notifService.notifyAppointmentFollowUp(req.auth.uid, {
      doctorName: body.doctorName || 'Dr. Ananya Mehta',
      specialty: body.specialty || 'General Physician',
      hoursAhead: body.hoursAhead !== undefined ? body.hoursAhead : 24,
      time: '10:00 AM',
    });
  } else if (body.type === 'LAB_REPORT_READY') {
    result = await notifService.notifyLabReportReady(req.auth.uid, {
      id: `test-doc-${Date.now()}`,
      name: body.documentName || 'Complete Blood Count (CBC) Report',
      findingsCount: body.findingsCount ?? 6,
    });
  } else {
    result = await notifService.sendNotification(req.auth.uid, {
      title: 'HealthSaathi Reminder Alert',
      body: 'This is a test notification to verify your device alerts and FCM push setup.',
      type: 'GENERAL',
    });
  }

  created(req, res, result);
});

export default router;
