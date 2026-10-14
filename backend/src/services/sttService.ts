/**
 * HealthSaathi AI - Groq Speech-to-Text (STT) Service
 *
 * Exclusively handles audio transcription using Groq's Whisper API:
 * POST https://api.groq.com/openai/v1/audio/transcriptions
 * Default Model: whisper-large-v3-turbo
 *
 * Security:
 * - Reads GROQ_API_KEY_STT exclusively from server-side environment.
 * - Never returns or logs the secret key.
 * - In-memory buffers are processed and immediately discarded.
 */

import Groq, { toFile } from 'groq-sdk';
import { getEnv } from '../config/env';
import { AppError, RateLimitError, ValidationError } from '../utils/errors';

export interface TranscribeOptions {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  language?: string;
}

export interface TranscribeResult {
  text: string;
  model: string;
  language?: string;
}

export class SttService {
  private client: Groq | null = null;
  private model: string;
  private apiKey: string | undefined;

  constructor(apiKeyOverride?: string) {
    const env = getEnv();
    this.apiKey = apiKeyOverride ?? env.GROQ_API_KEY_STT ?? env.GROQ_API_KEY;
    this.model = env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

    if (this.apiKey) {
      this.client = new Groq({ apiKey: this.apiKey });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
    const { buffer, filename, mimetype, language } = options;

    if (!this.isConfigured() || !this.client) {
      throw new AppError(
        503,
        'STT_NOT_CONFIGURED',
        'Speech-to-text service is currently not configured on this server.'
      );
    }

    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Audio payload is empty');
    }

    // Maximum file size for Groq Whisper transcription is 25 MB
    const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new ValidationError('Audio file exceeds the maximum 25 MB limit');
    }

    // Determine safe upload filename with proper extension
    let safeName = filename || 'recording.webm';
    if (!/\.(webm|mp4|mpeg|mp3|m4a|wav|ogg|flac|aac)$/i.test(safeName)) {
      if (mimetype.includes('mp4')) safeName = 'recording.mp4';
      else if (mimetype.includes('wav')) safeName = 'recording.wav';
      else if (mimetype.includes('ogg')) safeName = 'recording.ogg';
      else if (mimetype.includes('mp3') || mimetype.includes('mpeg')) safeName = 'recording.mp3';
      else safeName = 'recording.webm';
    }

    try {
      const file = await toFile(buffer, safeName, { type: mimetype || 'audio/webm' });

      const requestPayload: Groq.Audio.TranscriptionCreateParams = {
        file,
        model: this.model,
        response_format: 'json',
        temperature: 0.0,
      };

      // Whisper accepts ISO-639-1 code (e.g. 'en', 'te', 'hi').
      // If language is 'auto', empty, or omitted, Whisper performs automatic language detection.
      if (language && language !== 'auto' && /^[a-z]{2}(-[A-Z]{2})?$/i.test(language.trim())) {
        requestPayload.language = language.trim().slice(0, 2).toLowerCase();
      }

      const response = await this.client.audio.transcriptions.create(requestPayload);
      const text = (response?.text || '').trim();

      return {
        text,
        model: this.model,
        language: requestPayload.language,
      };
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string; code?: string };

      if (error.status === 401) {
        throw new AppError(
          502,
          'STT_AUTH_FAILED',
          'Speech transcription authentication failed with upstream provider.'
        );
      }

      if (error.status === 429) {
        throw new RateLimitError(
          'Speech transcription rate limit reached. Please wait a moment and try again.'
        );
      }

      if (error.status === 400) {
        throw new ValidationError(
          `Audio transcription rejected by provider: ${error.message || 'Unsupported or corrupt audio file'}`
        );
      }

      // Safe general diagnostic without leaking authorization or sensitive parameters
      console.error('[SttService] Upstream Groq transcription error:', error.message || 'Unknown error');
      throw new AppError(
        502,
        'STT_SERVICE_ERROR',
        'Speech transcription service encountered a momentary failure. Please try again.'
      );
    }
  }
}

let _sttService: SttService | null = null;

export function getSttService(): SttService {
  if (!_sttService) {
    _sttService = new SttService();
  }
  return _sttService;
}
