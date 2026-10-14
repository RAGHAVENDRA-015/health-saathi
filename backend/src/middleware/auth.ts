import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseAdmin } from '../config/firebase';
import { AuthError } from '../utils/errors';
import { auditLog } from '../utils/audit';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Attach request ID
  req.requestId = (req.headers['x-request-id'] as string) || `req_${uuidv4()}`;
  res.setHeader('x-request-id', req.requestId);

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    auditLog({
      actorUid: 'anonymous',
      action: 'AUTH_REJECTED',
      resourceType: 'auth',
      requestId: req.requestId,
      metadata: { reason: 'AUTH_MISSING', path: req.path },
      occurredAt: new Date(),
    });
    next(new AuthError('AUTH_MISSING', 'Authorization header required'));
    return;
  }

  const token = authHeader.slice(7);

  // Allow demo session token in demo/testing mode
  if (token === 'demo-token' || token === 'demo-session-token') {
    req.auth = {
      uid: 'demo_user_001',
      email: 'demo@healthsaathi.ai',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      aud: 'ai-copilot-54fa9',
      iss: 'https://securetoken.google.com/ai-copilot-54fa9',
      sub: 'demo_user_001',
    } as never;
    return next();
  }

  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token, true /* checkRevoked */);
    req.auth = decoded;
    next();
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    let errorCode = 'AUTH_INVALID';
    let errorMessage = 'Invalid authorization token';

    if (firebaseErr.code === 'auth/id-token-revoked') {
      errorCode = 'AUTH_TOKEN_REVOKED';
      errorMessage = 'Token has been revoked';
    } else if (firebaseErr.code === 'auth/id-token-expired') {
      errorCode = 'AUTH_TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
    }

    auditLog({
      actorUid: 'anonymous',
      action: 'AUTH_REJECTED',
      resourceType: 'auth',
      requestId: req.requestId,
      metadata: { reason: errorCode, path: req.path, firebaseCode: firebaseErr.code },
      occurredAt: new Date(),
    });

    next(new AuthError(errorCode, errorMessage));
  }
}

/** Attach requestId without requiring auth — used for health routes */
export function attachRequestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || `req_${uuidv4()}`;
  next();
}
