import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { getEnv } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import healthRouter from './routes/health';
import usersRouter from './routes/users';
import medicinesRouter from './routes/medicines';
import appointmentsRouter from './routes/appointments';
import remindersRouter from './routes/reminders';
import documentsRouter from './routes/documents';
import dashboardRouter from './routes/dashboard';
import copilotRouter from './routes/copilot';
import authRouter from './routes/auth';
import notificationsRouter from './routes/notifications';
import sttRouter from './routes/stt';

export function createApp(): express.Application {
  const env = getEnv();
  const app = express();

  // ─── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = env.API_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server or same-origin (no origin header)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // In non-production, permit all localhost and local LAN IPs (192.168.x.x, 10.x.x.x, etc.)
        if (env.NODE_ENV !== 'production') {
          if (
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(origin)
          ) {
            return callback(null, true);
          }
        }

        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id', 'Idempotency-Key'],
    })
  );

  // ─── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Logging ───────────────────────────────────────────────────────────────
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: (req) => req.url.startsWith('/health'),
    })
  );

  // ─── Global rate limits ────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Upload limit reached. Please wait before uploading more files.' } },
  });

  const copilotLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' } },
  });

  app.use(globalLimiter);

  // ─── Routes ────────────────────────────────────────────────────────────────
  const api = '/api/v1';

  // Public health endpoints
  app.use('/health', healthRouter);

  // Protected API
  app.use(`${api}/auth`, authRouter);
  app.use(`${api}`, usersRouter);
  app.use(`${api}`, medicinesRouter);
  app.use(`${api}`, appointmentsRouter);
  app.use(`${api}`, remindersRouter);
  app.use(`${api}/documents/uploads`, uploadLimiter);
  app.use(`${api}`, documentsRouter);
  app.use(`${api}`, dashboardRouter);
  app.use(`${api}/copilot`, copilotLimiter);
  app.use(`${api}`, copilotRouter);
  app.use(`${api}`, notificationsRouter);
  app.use(`${api}`, sttRouter);

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      meta: { requestId: 'unknown' },
    });
  });

  // ─── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
