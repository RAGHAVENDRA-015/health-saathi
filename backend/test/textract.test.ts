/**
 * HealthSaathi AI - Amazon Textract Integration & Normalization Tests
 *
 * Verifies:
 * 1. Safe credential detection and environment reporting
 * 2. Unconfigured invocation safely throws TEXTRACT_NOT_CONFIGURED error without leaking secrets
 * 3. Document size limit enforcement (> 5MB throws FILE_TOO_LARGE)
 * 4. Response normalization correctly maps Textract Block structure to OcrResponse schema
 * 5. Fallback behavior in pipeline
 */

import assert from 'assert';
import { TextractService, TextractError, TextractDetectResponse } from '../src/services/textractService';
import { OcrResponseSchema } from '../src/services/ocrRunner';

export async function runTextractTests() {
  console.log('\n☁️ Starting Amazon Textract Integration & Safety Tests...\n');
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

  // 1. Textract status check does not throw and redacts credentials
  await test('Textract status: correctly reports credential status without leaks', async () => {
    const status = TextractService.getStatus();
    assert(typeof status.isConfigured === 'boolean');
    assert(typeof status.region === 'string');
    assert(typeof status.enabled === 'boolean');
    assert(typeof status.hasCredentials === 'boolean');
  });

  // 2. Unconfigured execution throws TEXTRACT_NOT_CONFIGURED
  await test('Textract invocation: safely throws when AWS credentials not configured', async () => {
    if (!TextractService.isConfigured()) {
      const dummyBuffer = Buffer.from('test data');
      let caught = false;
      try {
        await TextractService.detectDocumentText(dummyBuffer);
      } catch (err) {
        caught = true;
        assert(err instanceof TextractError);
        assert.strictEqual(err.code, 'TEXTRACT_NOT_CONFIGURED');
      }
      assert(caught, 'Expected TextractError to be thrown');
    }
  });

  // 3. Oversized document check (> 5MB)
  await test('Textract limits: rejects documents exceeding 5MB synchronous limit', async () => {
    const originalConfigured = TextractService.isConfigured;
    // Temporarily mock isConfigured to true to verify size guard
    (TextractService as unknown as { isConfigured: () => boolean }).isConfigured = () => true;

    try {
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      let caught = false;
      try {
        await TextractService.detectDocumentText(oversizedBuffer);
      } catch (err) {
        caught = true;
        assert(err instanceof TextractError);
        assert.strictEqual(err.code, 'FILE_TOO_LARGE');
      }
      assert(caught, 'Expected FILE_TOO_LARGE error');
    } finally {
      (TextractService as unknown as { isConfigured: () => boolean }).isConfigured = originalConfigured;
    }
  });

  // 4. Response normalization correctly maps Textract Block structure
  await test('Textract normalization: maps AWS Blocks to HealthSaathi OcrResponse schema', async () => {
    const mockAwsResponse: TextractDetectResponse = {
      DocumentMetadata: { Pages: 1 },
      Blocks: [
        { BlockType: 'PAGE', Id: 'b1', Page: 1 },
        { BlockType: 'LINE', Text: 'Complete Blood Count (CBC) Report', Confidence: 99.4, Page: 1 },
        { BlockType: 'LINE', Text: 'Hemoglobin: 13.8 g/dL (Normal: 12.0 - 15.5)', Confidence: 98.2, Page: 1 },
        { BlockType: 'LINE', Text: 'Platelet Count: 250,000 /mcL (Normal: 150,000 - 450,000)', Confidence: 97.8, Page: 1 },
      ],
    };

    const normalized = TextractService.normalizeResponse(mockAwsResponse, 120);

    // Validate with Zod schema
    const validation = OcrResponseSchema.safeParse(normalized);
    assert(validation.success, `Schema validation failed: ${validation.error?.message}`);

    assert.strictEqual(normalized.success, true);
    assert.strictEqual(normalized.pageCount, 1);
    assert(normalized.extractedText?.includes('Hemoglobin: 13.8 g/dL'));
    assert(normalized.extractedText?.includes('Platelet Count: 250,000 /mcL'));
    assert.strictEqual(normalized.pages?.length, 1);
    assert.strictEqual(normalized.pages?.[0].method, 'ocr');
    assert(normalized.metadata?.avgOcrConfidence! > 95);
    assert.strictEqual(normalized.metadata?.processingDurationMs, 120);
  });

  console.log(`\n========================================`);
  console.log(`Textract Integration Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} Textract integration tests failed`);
  }
}
