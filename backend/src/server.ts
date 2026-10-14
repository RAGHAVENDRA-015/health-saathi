import { getEnv } from './config/env';
import { connectMongo, closeMongo } from './config/mongo';
import { initFirebase } from './config/firebase';
import { createApp } from './app';
import { startWorkerDaemon } from './workers/documentWorker';
import { startReminderScheduler } from './workers/reminderWorker';

async function main() {
  const env = getEnv();

  // 1. Create and start Express server immediately so Cloud Run/liveness checks pass
  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`🚀 HealthSaathi API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`   Health: http://localhost:${env.PORT}/health/live`);
    console.log(`   API base: http://localhost:${env.PORT}/api/v1`);
  });

  // 2. Initialize Firebase Admin
  try {
    initFirebase();
  } catch (err) {
    console.error('⚠️ [startup] Firebase Admin init error:', err);
  }

  // 3. Connect MongoDB & start workers
  try {
    await connectMongo();
    startWorkerDaemon();
    startReminderScheduler();
  } catch (err) {
    console.error('❌ [startup] MongoDB connection failed:', err);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] Received ${signal} — closing server...`);
    server.close(async () => {
      await closeMongo();
      console.log('[shutdown] Clean exit');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
}

main().catch((err) => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});
