import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../config/mongo';
import { requireAuth } from '../middleware/auth';
import { UserDoc } from '../types/models';
import { ok } from '../utils/response';
// AuthRequest alias for clarity
type AuthRequest = Request;
import { NotFoundError, ValidationError } from '../utils/errors';
import { auditLog } from '../utils/audit';
import { getMemoryService } from '../services/memoryService';

const router = Router();
router.use(requireAuth);

// ─── Upsert minimal profile on first request ──────────────────────────────────
async function upsertProfile(
  uid: string,
  email: string,
  displayName?: string,
  avatar?: string
): Promise<UserDoc> {
  const db = getDb();
  const now = new Date();

  const setOnInsert: Record<string, unknown> = {
    firebaseUid: uid,
    email: email ?? '',
    preferences: {
      language: 'en',
      notifications: true,
      accessibility: { highContrast: false, fontSize: 'medium' },
    },
    consent: {},
    createdAt: now,
    schemaVersion: 1,
  };

  const setObj: Record<string, unknown> = {
    updatedAt: now,
  };

  if (displayName) {
    setObj['displayName'] = displayName;
  } else {
    setOnInsert['displayName'] = '';
  }

  if (avatar) {
    setObj['avatar'] = avatar;
  } else {
    setOnInsert['avatar'] = '';
  }

  const result = await db.collection<UserDoc>('users').findOneAndUpdate(
    { firebaseUid: uid },
    {
      $setOnInsert: setOnInsert,
      $set: setObj,
    },
    { upsert: true, returnDocument: 'after' }
  );

  return result as UserDoc;
}

// GET /me
router.get('/me', async (req: AuthRequest, res: Response) => {
  const { uid, email, name, picture } = req.auth;
  const user = await upsertProfile(uid, email ?? '', name, picture);
  ok(req, res, {
    ...user,
    emailVerified: Boolean(req.auth.email_verified),
    providerId: req.auth.firebase?.sign_in_provider || 'password',
  });
});

// PATCH /me
const patchMeSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  fullName: z.string().min(1).max(100).optional(),
  avatar: z.string().optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().max(200).optional(),
  bloodGroup: z.string().max(10).optional(),
  age: z.union([z.number(), z.string()]).optional(),
  city: z.string().max(100).optional(),
  allergies: z.string().max(1000).optional(),
  conditions: z.string().max(1000).optional(),
  healthNotes: z.string().max(2000).optional(),
  emergencyContact: z.union([z.string().max(100), z.record(z.unknown())]).optional(),
  preferences: z
    .object({
      language: z.enum(['en', 'te', 'hi']).optional(),
      preferredLanguage: z.enum(['en', 'te', 'hi']).optional(),
      hasSelectedLanguage: z.boolean().optional(),
      notifications: z.boolean().optional(),
      accessibility: z
        .object({
          highContrast: z.boolean().optional(),
          fontSize: z.enum(['small', 'medium', 'large']).optional(),
        })
        .optional(),
    })
    .optional(),
  consent: z
    .object({ version: z.string().optional(), acceptedAt: z.string().datetime().optional() })
    .optional(),
});

router.patch('/me', async (req: AuthRequest, res: Response) => {
  const body = patchMeSchema.parse(req.body);
  const db = getDb();
  const now = new Date();

  const flatUpdate: Record<string, unknown> = { updatedAt: now };
  if (body.displayName !== undefined) flatUpdate['displayName'] = body.displayName;
  if (body.fullName !== undefined) {
    flatUpdate['fullName'] = body.fullName;
    if (!body.displayName) flatUpdate['displayName'] = body.fullName;
  }
  if (body.avatar !== undefined) flatUpdate['avatar'] = body.avatar;
  if (body.phone !== undefined) flatUpdate['phone'] = body.phone;
  if (body.dateOfBirth !== undefined) flatUpdate['dateOfBirth'] = body.dateOfBirth;
  if (body.location !== undefined) flatUpdate['location'] = body.location;
  if (body.bloodGroup !== undefined) flatUpdate['bloodGroup'] = body.bloodGroup;
  if (body.age !== undefined) flatUpdate['age'] = typeof body.age === 'string' ? parseInt(body.age, 10) || body.age : body.age;
  if (body.city !== undefined) flatUpdate['city'] = body.city;
  if (body.allergies !== undefined) flatUpdate['allergies'] = body.allergies;
  if (body.conditions !== undefined) flatUpdate['conditions'] = body.conditions;
  if (body.healthNotes !== undefined) flatUpdate['healthNotes'] = body.healthNotes;
  if (body.emergencyContact !== undefined) flatUpdate['emergencyContact'] = typeof body.emergencyContact === 'string' ? body.emergencyContact : JSON.stringify(body.emergencyContact);
  const lang = body.preferences?.language || body.preferences?.preferredLanguage;
  if (lang !== undefined) {
    flatUpdate['preferences.language'] = lang;
    flatUpdate['preferences.preferredLanguage'] = lang;
    flatUpdate['preferences.hasSelectedLanguage'] = true;
    flatUpdate['preferredLanguage'] = lang;
  }
  if (body.preferences?.hasSelectedLanguage !== undefined) {
    flatUpdate['preferences.hasSelectedLanguage'] = body.preferences.hasSelectedLanguage;
  }
  if (body.preferences?.notifications !== undefined) flatUpdate['preferences.notifications'] = body.preferences.notifications;
  if (body.preferences?.accessibility?.highContrast !== undefined) flatUpdate['preferences.accessibility.highContrast'] = body.preferences.accessibility.highContrast;
  if (body.preferences?.accessibility?.fontSize !== undefined) flatUpdate['preferences.accessibility.fontSize'] = body.preferences.accessibility.fontSize;
  if (body.consent) {
    flatUpdate['consent'] = {
      version: body.consent.version,
      acceptedAt: body.consent.acceptedAt ? new Date(body.consent.acceptedAt) : undefined,
    };
  }

  const result = await db.collection<UserDoc>('users').findOneAndUpdate(
    { firebaseUid: req.auth.uid },
    { $set: flatUpdate },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('User profile not found');

  if (body.allergies !== undefined || body.conditions !== undefined || body.healthNotes !== undefined) {
    getMemoryService().syncProfileToClinicalMemories(req.auth.uid, {
      allergies: body.allergies,
      conditions: body.conditions,
      healthNotes: body.healthNotes,
    }).catch((err) => console.warn('[users.ts] Profile memory sync warning:', err));
  }

  await auditLog({
    actorUid: req.auth.uid,
    action: 'USER_PROFILE_UPDATED',
    resourceType: 'user',
    requestId: req.requestId,
    occurredAt: now,
  });

  ok(req, res, result);
});

// GET /users/me/preferences & GET /me/preferences
const preferencesPaths = ['/users/me/preferences', '/me/preferences'];

router.get(preferencesPaths, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = await db.collection<UserDoc>('users').findOne({ firebaseUid: req.auth.uid });
  if (!user) throw new NotFoundError('User profile not found');

  const prefs = user.preferences || {
    language: 'en',
    preferredLanguage: 'en',
    notifications: true,
    accessibility: { highContrast: false, fontSize: 'medium' },
  };

  ok(req, res, {
    language: prefs.language || prefs.preferredLanguage || 'en',
    preferredLanguage: prefs.preferredLanguage || prefs.language || 'en',
    hasSelectedLanguage: Boolean(prefs.hasSelectedLanguage),
    notifications: prefs.notifications ?? true,
    accessibility: prefs.accessibility || { highContrast: false, fontSize: 'medium' },
  });
});

// PATCH /users/me/preferences & PATCH /me/preferences
const patchPreferencesSchema = z
  .object({
    language: z.enum(['en', 'te', 'hi']).optional(),
    preferredLanguage: z.enum(['en', 'te', 'hi']).optional(),
    hasSelectedLanguage: z.boolean().optional(),
    notifications: z.boolean().optional(),
    accessibility: z
      .object({
        highContrast: z.boolean().optional(),
        fontSize: z.enum(['small', 'medium', 'large']).optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one preference field must be provided',
  });

router.patch(preferencesPaths, async (req: AuthRequest, res: Response) => {
  const body = patchPreferencesSchema.parse(req.body);
  const db = getDb();
  const now = new Date();

  const flatUpdate: Record<string, unknown> = { updatedAt: now };
  const lang = body.language || body.preferredLanguage;
  if (lang !== undefined) {
    flatUpdate['preferences.language'] = lang;
    flatUpdate['preferences.preferredLanguage'] = lang;
    flatUpdate['preferences.hasSelectedLanguage'] = true;
    flatUpdate['preferredLanguage'] = lang;
  }
  if (body.hasSelectedLanguage !== undefined) {
    flatUpdate['preferences.hasSelectedLanguage'] = body.hasSelectedLanguage;
  }
  if (body.notifications !== undefined) {
    flatUpdate['preferences.notifications'] = body.notifications;
  }
  if (body.accessibility?.highContrast !== undefined) {
    flatUpdate['preferences.accessibility.highContrast'] = body.accessibility.highContrast;
  }
  if (body.accessibility?.fontSize !== undefined) {
    flatUpdate['preferences.accessibility.fontSize'] = body.accessibility.fontSize;
  }

  const result = await db.collection<UserDoc>('users').findOneAndUpdate(
    { firebaseUid: req.auth.uid },
    { $set: flatUpdate },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('User profile not found');

  await auditLog({
    actorUid: req.auth.uid,
    action: 'USER_PREFERENCES_UPDATED',
    resourceType: 'user',
    requestId: req.requestId,
    occurredAt: now,
  });

  const updatedPrefs = result.preferences || {};
  ok(req, res, {
    language: updatedPrefs.language || updatedPrefs.preferredLanguage || 'en',
    preferredLanguage: updatedPrefs.preferredLanguage || updatedPrefs.language || 'en',
    hasSelectedLanguage: Boolean(updatedPrefs.hasSelectedLanguage),
    notifications: updatedPrefs.notifications ?? true,
    accessibility: updatedPrefs.accessibility || { highContrast: false, fontSize: 'medium' },
  });
});

// POST /me/reset-preferences
router.post('/me/reset-preferences', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const defaultPrefs = {
    language: 'en',
    notifications: true,
    accessibility: { highContrast: false, fontSize: 'medium' },
  };

  const result = await db.collection<UserDoc>('users').findOneAndUpdate(
    { firebaseUid: req.auth.uid },
    { $set: { preferences: defaultPrefs, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('User profile not found');
  ok(req, res, result);
});

// DELETE /me — initiate async account deletion
router.delete('/me', async (req: AuthRequest, res: Response) => {
  const body = z.object({ confirm: z.literal('DELETE_MY_ACCOUNT') }).parse(req.body);
  if (!body) throw new ValidationError('Confirmation required');

  const db = getDb();
  const now = new Date();

  await auditLog({
    actorUid: req.auth.uid,
    action: 'ACCOUNT_DELETION_REQUESTED',
    resourceType: 'user',
    requestId: req.requestId,
    metadata: { requestedAt: now.toISOString() },
    occurredAt: now,
  });

  // Enqueue deletion job
  await db.collection('processing_jobs').insertOne({
    ownerId: req.auth.uid,
    type: 'ACCOUNT_DELETION',
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: `account_delete_${req.auth.uid}`,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });

  ok(req, res, { message: 'Account deletion initiated. Data will be erased within 24 hours.' });
});

export default router;
