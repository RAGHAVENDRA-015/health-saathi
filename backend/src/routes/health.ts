import { Router, Request, Response } from 'express';
import { getDb } from '../config/mongo';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    res.json({ status: 'ok', mongodb: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', mongodb: 'disconnected' });
  }
});

export default router;
