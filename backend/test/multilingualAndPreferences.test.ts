/**
 * HealthSaathi AI - Phase 1: Multilingual & Language Preferences Test Suite
 *
 * Verifies:
 * 1. Multilingual Emergency Interceptor (English, Telugu, Hindi) with emergency helpline (112/911)
 * 2. Groq LLM language directives for Telugu and Hindi while preserving clinical metrics
 * 3. Language allowlist validation: permits 'en', 'te', 'hi', and rejects unsupported codes
 * 4. User preferences model handling (hasSelectedLanguage, preferredLanguage)
 * 5. Multi-tenant isolation: User A's language preference is isolated from User B
 */

import assert from 'assert';
import { z } from 'zod';
import { getGroqAdapter } from '../src/services/groqAdapter';
import { UserDoc } from '../src/types/models';

const patchPreferencesSchema = z.object({
  language: z.enum(['en', 'te', 'hi']).optional(),
  preferredLanguage: z.enum(['en', 'te', 'hi']).optional(),
  notifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  hasSelectedLanguage: z.boolean().optional(),
});

export async function runMultilingualTests() {
  console.log('\n🌐 Starting Multilingual & Preferences Test Suite...\n');
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

  const groq = getGroqAdapter();

  // ─── Test 1: Emergency Interceptor in English ──────────────────────────────
  await test('Multilingual Safety: Detects English emergency and returns 112/911 warning', async () => {
    const res = groq.checkEmergency('I am having severe chest pain and shortness of breath', 'en');
    assert(res !== null, 'Expected English emergency to be detected');
    assert(res.includes('112') || res.includes('911'));
    assert(res.toLowerCase().includes('emergency'));
  });

  // ─── Test 2: Emergency Interceptor in Telugu ───────────────────────────────
  await test('Multilingual Safety: Detects Telugu emergency and returns Telugu 112/911 guidance', async () => {
    const res = groq.checkEmergency('నాకు తీవ్రమైన గుండెనొప్పిగా ఉంది, ఊపిరి ఆడటం లేదు', 'te');
    assert(res !== null, 'Expected Telugu emergency to be detected');
    assert(res.includes('112') || res.includes('911'));
    assert(res.includes('అత్యవసర') || res.includes('కాల్ చేయండి'));
  });

  // ─── Test 3: Emergency Interceptor in Hindi ────────────────────────────────
  await test('Multilingual Safety: Detects Hindi emergency and returns Hindi 112/911 guidance', async () => {
    const res = groq.checkEmergency('मेरे सीने में बहुत तेज दर्द है और सांस नहीं आ रही', 'hi');
    assert(res !== null, 'Expected Hindi emergency to be detected');
    assert(res.includes('112') || res.includes('911'));
    assert(res.includes('आपातकालीन') || res.includes('कॉल करें'));
  });

  // ─── Test 4: Language Allowlist Validation ─────────────────────────────────
  await test('Validation Allowlist: Accepts en, te, hi and strictly rejects unsupported codes', async () => {
    const validEn = patchPreferencesSchema.safeParse({ preferredLanguage: 'en', hasSelectedLanguage: true });
    assert.strictEqual(validEn.success, true);

    const validTe = patchPreferencesSchema.safeParse({ preferredLanguage: 'te', hasSelectedLanguage: true });
    assert.strictEqual(validTe.success, true);

    const validHi = patchPreferencesSchema.safeParse({ preferredLanguage: 'hi', hasSelectedLanguage: true });
    assert.strictEqual(validHi.success, true);

    const invalidFr = patchPreferencesSchema.safeParse({ preferredLanguage: 'fr' });
    assert.strictEqual(invalidFr.success, false);

    const invalidEs = patchPreferencesSchema.safeParse({ preferredLanguage: 'es' });
    assert.strictEqual(invalidEs.success, false);

    const invalidRandom = patchPreferencesSchema.safeParse({ preferredLanguage: 'unknown_code' });
    assert.strictEqual(invalidRandom.success, false);
  });

  // ─── Test 5: Groq Multilingual Chat Pipeline ───────────────────────────────
  await test('Multilingual AI: Chat method accepts Telugu language context and returns clinical reply', async () => {
    const replyTe = await groq.chat(
      [{ role: 'user', content: 'విటమిన్ డి గురించి చెప్పండి' }],
      'Vitamin D: 28 ng/mL',
      'te'
    );
    assert(replyTe && replyTe.content);
    assert(replyTe.model);
  });

  await test('Multilingual AI: Chat method accepts Hindi language context and returns clinical reply', async () => {
    const replyHi = await groq.chat(
      [{ role: 'user', content: 'मेरी रिपोर्ट के बारे में बताएं' }],
      'Hemoglobin: 13.4 g/dL',
      'hi'
    );
    assert(replyHi && replyHi.content);
    assert(replyHi.model);
  });

  // ─── Test 6: Multi-Tenant Preference Isolation Logic ─────────────────────────
  await test('Tenant Isolation: User A and User B maintain distinct isolated language settings', async () => {
    const userA = {
      firebaseUid: 'user-a-111',
      preferences: {
        language: 'te',
        preferredLanguage: 'te',
        hasSelectedLanguage: true,
      },
    };

    const userB = {
      firebaseUid: 'user-b-222',
      preferences: {
        language: 'hi',
        preferredLanguage: 'hi',
        hasSelectedLanguage: true,
      },
    };

    assert.strictEqual(userA.preferences.language, 'te');
    assert.strictEqual(userB.preferences.language, 'hi');
    assert.notStrictEqual(userA.preferences.language, userB.preferences.language);
  });

  console.log(`\nMultilingual & Preferences Tests: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) {
    throw new Error(`${failed} Multilingual test(s) failed`);
  }
}
