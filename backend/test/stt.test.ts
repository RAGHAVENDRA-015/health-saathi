/**
 * HealthSaathi AI - Groq Speech-to-Text (STT) Test Suite
 *
 * Verifies:
 * 1. Missing GROQ_API_KEY_STT returns controlled error (STT_NOT_CONFIGURED / 503)
 * 2. Empty audio payload is rejected with ValidationError (400)
 * 3. Oversized audio (>25 MB) is rejected with ValidationError
 * 4. SttService correctly constructs transcription parameters (model whisper-large-v3-turbo, language)
 * 5. Handles upstream Groq authentication (401) and rate limits (429) gracefully
 * 6. Multilingual language codes ('en', 'te', 'hi') are normalized to ISO-639-1
 * 7. End-to-end mocked transcription returns recognized text
 * 8. Never leaks the API key in results or error messages
 */

import assert from 'assert';
import { SttService } from '../src/services/sttService';
import { AppError, RateLimitError, ValidationError } from '../src/utils/errors';

export async function runSttTests() {
  console.log('\n🎙️ Starting Groq Speech-to-Text (STT) Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`  ▶ ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err: unknown) {
      const e = err as Error;
      console.log(`❌ FAIL\n     Error: ${e.message}\n     ${e.stack}`);
      failed++;
    }
  }

  // ─── Test 1: Missing API Key Handling ─────────────────────────────────────
  await test('STT Configuration: Throws controlled STT_NOT_CONFIGURED when API key is missing', async () => {
    const unconfiguredService = new SttService('');
    assert.strictEqual(unconfiguredService.isConfigured(), false);

    try {
      await unconfiguredService.transcribe({
        buffer: Buffer.from('fake-audio-bytes'),
        filename: 'test.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should have thrown AppError');
    } catch (err: unknown) {
      assert(err instanceof AppError);
      assert.strictEqual((err as AppError).code, 'STT_NOT_CONFIGURED');
      assert.strictEqual((err as AppError).statusCode, 503);
    }
  });

  // ─── Test 2: Empty Audio Validation ───────────────────────────────────────
  await test('Audio Validation: Rejects empty audio buffer with ValidationError', async () => {
    const service = new SttService('mock-api-key');
    try {
      await service.transcribe({
        buffer: Buffer.alloc(0),
        filename: 'empty.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should have rejected empty buffer');
    } catch (err: unknown) {
      assert(err instanceof ValidationError);
      assert.strictEqual((err as ValidationError).statusCode, 400);
    }
  });

  // ─── Test 3: Oversized Audio Validation (>25 MB) ──────────────────────────
  await test('Audio Validation: Rejects oversized audio exceeding 25 MB limit', async () => {
    const service = new SttService('mock-api-key');
    const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
    try {
      await service.transcribe({
        buffer: oversizedBuffer,
        filename: 'huge.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should have rejected oversized buffer');
    } catch (err: unknown) {
      assert(err instanceof ValidationError);
      assert.strictEqual((err as ValidationError).statusCode, 400);
      assert((err as ValidationError).message.includes('25 MB'));
    }
  });

  // ─── Test 4: Mocked Successful Transcription ──────────────────────────────
  await test('STT Execution: Successfully invokes Groq Whisper client and extracts transcript text', async () => {
    const mockApiKey = 'gsk_mock_stt_test_key_12345';
    const service = new SttService(mockApiKey);

    let capturedPayload: any = null;
    (service as any).client = {
      audio: {
        transcriptions: {
          create: async (params: any) => {
            capturedPayload = params;
            return { text: 'What is my latest blood test report showing?' };
          },
        },
      },
    };

    const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....');
    const result = await service.transcribe({
      buffer: dummyAudio,
      filename: 'voice-query.wav',
      mimetype: 'audio/wav',
      language: 'en',
    });

    assert.strictEqual(result.text, 'What is my latest blood test report showing?');
    assert.strictEqual(result.model, 'whisper-large-v3-turbo');
    assert.strictEqual(capturedPayload.model, 'whisper-large-v3-turbo');
    assert.strictEqual(capturedPayload.language, 'en');
  });

  // ─── Test 5: Multilingual Language Normalization (Telugu, Hindi) ──────────
  await test('Multilingual STT: Correctly passes ISO-639-1 language code for Telugu and Hindi', async () => {
    const service = new SttService('mock-api-key');

    let capturedLanguage: string | undefined;
    (service as any).client = {
      audio: {
        transcriptions: {
          create: async (params: any) => {
            capturedLanguage = params.language;
            return { text: 'నాకు రక్త పరీక్ష ఫలితాలు కావాలి' };
          },
        },
      },
    };

    const dummyAudio = Buffer.from('webm-audio-bytes');

    // Telugu test
    await service.transcribe({
      buffer: dummyAudio,
      filename: 'speech.webm',
      mimetype: 'audio/webm',
      language: 'te',
    });
    assert.strictEqual(capturedLanguage, 'te');

    // Hindi test
    await service.transcribe({
      buffer: dummyAudio,
      filename: 'speech.webm',
      mimetype: 'audio/webm',
      language: 'hi',
    });
    assert.strictEqual(capturedLanguage, 'hi');

    // Auto / omitted language test (allows automatic speech detection)
    await service.transcribe({
      buffer: dummyAudio,
      filename: 'speech.webm',
      mimetype: 'audio/webm',
      language: 'auto',
    });
    assert.strictEqual(capturedLanguage, undefined, 'Language should be omitted for auto-detection');
  });

  // ─── Test 6: Upstream Upstream Rate Limits & Auth Failures ────────────────
  await test('Error Handling: Gracefully maps 401 to STT_AUTH_FAILED and 429 to STT_RATE_LIMITED', async () => {
    const service = new SttService('mock-api-key');

    // 401 Auth error
    (service as any).client = {
      audio: {
        transcriptions: {
          create: async () => {
            const err = new Error('Invalid API key') as any;
            err.status = 401;
            throw err;
          },
        },
      },
    };

    try {
      await service.transcribe({
        buffer: Buffer.from('audio'),
        filename: 'test.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should throw STT_AUTH_FAILED');
    } catch (err: unknown) {
      assert(err instanceof AppError);
      assert.strictEqual((err as AppError).code, 'STT_AUTH_FAILED');
      assert.strictEqual((err as AppError).statusCode, 502);
    }

    // 429 Rate limit error
    (service as any).client = {
      audio: {
        transcriptions: {
          create: async () => {
            const err = new Error('Rate limit exceeded') as any;
            err.status = 429;
            throw err;
          },
        },
      },
    };

    try {
      await service.transcribe({
        buffer: Buffer.from('audio'),
        filename: 'test.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should throw STT_RATE_LIMITED');
    } catch (err: unknown) {
      assert(err instanceof RateLimitError);
      assert.strictEqual((err as RateLimitError).code, 'RATE_LIMITED');
      assert.strictEqual((err as RateLimitError).statusCode, 429);
    }
  });

  // ─── Test 7: Secret Non-Leakage Check ─────────────────────────────────────
  await test('Security: Never exposes API key in returned results or thrown errors', async () => {
    const secretKey = 'gsk_super_secret_stt_token_xyz987';
    const service = new SttService(secretKey);

    (service as any).client = {
      audio: {
        transcriptions: {
          create: async () => {
            throw new Error(`Upstream server error during audio processing`);
          },
        },
      },
    };

    try {
      await service.transcribe({
        buffer: Buffer.from('audio-bytes'),
        filename: 'test.webm',
        mimetype: 'audio/webm',
      });
      assert.fail('Should throw');
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      assert(!msg.includes(secretKey), 'Error message must never contain the API secret');
    }
  });

  console.log(`\nSTT Tests: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) {
    throw new Error(`${failed} STT test(s) failed`);
  }
}
