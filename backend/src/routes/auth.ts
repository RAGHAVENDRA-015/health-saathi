import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getFirebaseAdmin } from '../config/firebase';
import { auditLog } from '../utils/audit';
import { ok } from '../utils/response';
import { createHash } from 'crypto';

const router = Router();

const authEventSchema = z.object({
  event: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

function hashIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// POST /auth/events — record auth lifecycle events in immutable audit trail
router.post('/events', async (req: Request, res: Response) => {
  const body = authEventSchema.parse(req.body);

  let actorUid = 'anonymous';
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const admin = getFirebaseAdmin();
      const decoded = await admin.auth().verifyIdToken(token, false);
      actorUid = decoded.uid;
    } catch {
      // unverified token; actor remains anonymous
    }
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
  const ipHash = hashIp(clientIp);

  await auditLog({
    actorUid,
    action: `AUTH_${body.event.toUpperCase()}`,
    resourceType: 'auth',
    requestId: (req.headers['x-request-id'] as string) || 'req_auth',
    ipHash,
    metadata: {
      ...body.metadata,
      occurredAt: new Date().toISOString(),
    },
    occurredAt: new Date(),
  });

  ok(req, res, { logged: true });
});

export default router;
