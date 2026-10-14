/**
 * HealthSaathi AI - Speech-to-Text (STT) Express Router
 *
 * Endpoints:
 * - POST /api/v1/stt/transcribe
 *
 * Security:
 * - Protected with requireAuth (Firebase ID Token verification)
 * - Strict multipart validation (mime-type, file extension, max 25MB)
 * - Temporary in-memory processing only (no permanent audio storage)
 * - Secrets never exposed to client or logs
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { getSttService } from '../services/sttService';
import { ok } from '../utils/response';
import { ValidationError } from '../utils/errors';

const router = Router();
router.use(requireAuth);

const ALLOWED_AUDIO_MIMES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'video/webm', // MediaRecorder on some platforms emits video/webm container for audio
  'application/octet-stream', // Generic binary when extension indicates audio
];

const ALLOWED_AUDIO_EXTENSIONS = /\.(webm|mp4|mpeg|mp3|m4a|wav|ogg|flac|aac)$/i;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => {
    const isMimeValid = ALLOWED_AUDIO_MIMES.includes(file.mimetype);
    const isExtValid = ALLOWED_AUDIO_EXTENSIONS.test(file.originalname);

    if (isMimeValid || isExtValid) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_AUDIO_TYPE'));
    }
  },
});

const sttLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many transcription requests. Please wait a moment.' } },
});

// Single upload handler accepting either 'audio' or 'file' field name
const uploadAudio = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

router.post('/stt/transcribe', sttLimiter, (req: Request, res: Response, next) => {
  uploadAudio(req, res, (err: unknown) => {
    if (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: { code: 'FILE_TOO_LARGE', message: 'Audio file must be 25 MB or smaller.' },
          meta: { requestId: req.requestId },
        });
      }
      if (e.message === 'UNSUPPORTED_AUDIO_TYPE') {
        return res.status(415).json({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Unsupported audio format. Supported formats include WebM, MP4, MP3, M4A, WAV, and OGG.',
          },
          meta: { requestId: req.requestId },
        });
      }
      return next(err);
    }
    next();
  });
}, async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const audioFile = files?.audio?.[0] || files?.file?.[0] || req.file;

  if (!audioFile || !audioFile.buffer || audioFile.buffer.length === 0) {
    throw new ValidationError('A non-empty audio file is required for speech transcription');
  }

  const { buffer, originalname, mimetype } = audioFile;
  const language = typeof req.body.language === 'string' ? req.body.language : undefined;

  const sttService = getSttService();
  const result = await sttService.transcribe({
    buffer,
    filename: originalname,
    mimetype,
    language,
  });

  ok(req, res, {
    text: result.text,
  });
});

export default router;
