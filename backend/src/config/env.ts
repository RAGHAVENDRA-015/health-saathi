import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  API_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().default('healthsaathi'),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_API_KEY: z.string().optional(),
  VAPID: z.string().optional(),
  STORAGEBUCKET_KEY: z.string().optional().transform((val) => val ? val.replace(/^gs:\/\//, '').replace(/\/+$/, '').trim() : undefined),
  GROQ_API_KEY: z.string().optional(),
  GROQ_API_KEY_STT: z.string().optional(),
  GROQ_STT_MODEL: z.string().default('whisper-large-v3-turbo'),
  GROK_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROK_TIMEOUT_MS: z.string().default('30000').transform(Number),
  MAX_UPLOAD_BYTES: z.string().default('10485760').transform(Number),
  COPILOT_DAILY_MESSAGE_LIMIT: z.string().default('50').transform(Number),
  COPILOT_MAX_CONTEXT_TOKENS: z.string().default('8000').transform(Number),
  PYTHON_PATH: z.string().optional(),
  TESSERACT_CMD: z.string().optional(),
  TESSERACT_LANG: z.string().default('eng'),
  OCR_MAX_PAGES: z.string().default('500').transform(Number),
  OCR_TIMEOUT_MS: z.string().default('60000').transform(Number),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  ENABLE_AWS_TEXTRACT: z.string().default('false').transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Invalid environment configuration:');
      result.error.issues.forEach((issue) => {
        console.error(`   ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
