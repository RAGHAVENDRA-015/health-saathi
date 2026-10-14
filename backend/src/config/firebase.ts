import admin from 'firebase-admin';
import { getEnv } from './env';

let initialized = false;

export function initFirebase(): void {
  if (initialized) return;

  const env = getEnv();

  // Support both service-account credentials and project-only mode
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      storageBucket: env.STORAGEBUCKET_KEY,
    });
  } else {
    // Development mode: use project ID only (requires GOOGLE_APPLICATION_CREDENTIALS or emulator)
    admin.initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.STORAGEBUCKET_KEY,
    });
    console.warn('⚠️  Firebase Admin initialized without service-account credentials — token verification may use project-only mode');
  }

  initialized = true;
  console.log(`✅ Firebase Admin initialized — project: ${env.FIREBASE_PROJECT_ID}`);
}

export function getFirebaseAdmin(): typeof admin {
  if (!initialized) throw new Error('Firebase Admin not initialized — call initFirebase() first');
  return admin;
}

export function getFirebaseStorage() {
  const env = getEnv();
  return env.STORAGEBUCKET_KEY ? admin.storage().bucket(env.STORAGEBUCKET_KEY) : admin.storage().bucket();
}
