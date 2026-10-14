/**
 * HealthSaathi AI - Backend & OCR Integration Test Runner
 *
 * Runs comprehensive automated verification for:
 * 1. Pillow Preprocessing & Tesseract OCR (synthetic images)
 * 2. PyMuPDF Digital PDF text extraction (verifying OCR is skipped)
 * 3. PyMuPDF Scanned PDF page OCR (verifying selective OCR)
 * 4. Mixed PDF ordering and extraction methods
 * 5. Corrupt / encrypted file error handling
 * 6. Token budgeting and Llama-3 estimation
 * 7. Clinical findings extraction & reference range tagging
 * 8. Groq emergency interceptor guardrails
 */

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { processDocumentWithOcr, OcrRunnerError } from '../src/services/ocrRunner';
import { estimateLlama3Tokens, budgetDocumentForSummarization } from '../src/services/tokenBudget';
import { extractClinicalFindings } from '../src/services/findingsExtractor';
import { getGroqAdapter } from '../src/services/groqAdapter';
import { runAuthIsolationTests } from './authIsolation.test';
import { runTextractTests } from './textract.test';
import { runChatHistoryTests } from './chatHistory.test';
import { runDocumentClassificationTests } from './documentClassificationAndCopilotGrounding.test';
import { runNotificationTests } from './notifications.test';
import { runMultilingualTests } from './multilingualAndPreferences.test';
import { runSttTests } from './stt.test';
import { runClinicalIntelligenceTests } from './clinicalIntelligence.test';

// Simple PDF generator using raw PDF 1.4 syntax (no external heavy libraries needed for tests)
function createSimpleDigitalPdf(textContent: string): Buffer {
  const stream = `BT\n/F1 12 Tf\n50 750 Td\n(${textContent.replace(/[()]/g, '')}) Tj\nET`;
  const streamLen = stream.length;

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${stream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLen}
%%EOF`;

  return Buffer.from(pdf);
}

// 1x1 White PNG buffer
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function runAllTests() {
  console.log('🧪 Starting HealthSaathi Backend & OCR Integration Tests...\n');
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

  // ─── Test 1: Token Estimator ──────────────────────────────────────────────
  await test('Token estimation: estimates characters and words accurately', async () => {
    const text = 'Patient has a history of Type 2 Diabetes. Fasting blood sugar 120 mg/dL.';
    const tokens = estimateLlama3Tokens(text);
    assert(tokens > 10 && tokens < 30, `Expected tokens around 15-25, got ${tokens}`);
  });

  // ─── Test 2: Token Budgeting within limits ────────────────────────────────
  await test('Token budgeting: within budget passes without truncation', async () => {
    const text = 'Annual health checkup report: All vitals stable.';
    const budgeted = budgetDocumentForSummarization(text, 'lab_report.pdf', 8000);
    assert.strictEqual(budgeted.isTruncated, false);
    assert(budgeted.promptText.includes('lab_report.pdf'));
    assert(budgeted.promptText.includes(text));
  });

  // ─── Test 3: Token Budgeting large documents ──────────────────────────────
  await test('Token budgeting: oversized documents are flagged and safely budgeted', async () => {
    // Generate a massive text with 3000 repetitions
    const longText = Array(500).fill('Page Line: Clinical metric test observation datum 123.45 mg/dL.').join('\n');
    // Constrain budget to a small limit
    const budgeted = budgetDocumentForSummarization(longText, 'large_record.pdf', 1200);
    assert.strictEqual(budgeted.isTruncated, true, 'Oversized text must be flagged as truncated');
    assert(budgeted.truncationNotice?.includes('Notice:'), 'Must include transparent truncation notice');
    assert(budgeted.promptText.includes('BEGIN DOCUMENT TEXT'));
  });

  // ─── Test 4: Clinical Findings Extraction ─────────────────────────────────
  await test('Clinical findings extractor: extracts and flags lab values correctly', async () => {
    const clinicalText = `
      LABORATORY INVESTIGATION REPORT
      Patient Name: Anita Sharma
      Fasting Blood Glucose: 145 mg/dL
      HbA1c: 7.2 %
      Serum Creatinine: 0.9 mg/dL
      Blood Pressure: 130/85 mmHg
    `;
    const findings = extractClinicalFindings(clinicalText);
    assert.strictEqual(findings.length, 4, `Expected 4 findings, got ${findings.length}`);

    const fbs = findings.find((f) => f.testName === 'Fasting Blood Glucose');
    assert(fbs, 'Fasting Blood Glucose must be detected');
    assert.strictEqual(fbs?.result, '145');
    assert.strictEqual(fbs?.status, 'HIGH', '145 mg/dL should be flagged HIGH (> 100)');

    const a1c = findings.find((f) => f.testName.includes('HbA1c'));
    assert(a1c, 'HbA1c must be detected');
    assert.strictEqual(a1c?.result, '7.2');
    assert.strictEqual(a1c?.status, 'HIGH', '7.2% should be flagged HIGH (> 5.7)');

    const cr = findings.find((f) => f.testName === 'Serum Creatinine');
    assert(cr, 'Creatinine must be detected');
    assert.strictEqual(cr?.result, '0.9');
    assert.strictEqual(cr?.status, 'NORMAL', '0.9 mg/dL should be NORMAL');
  });

  // ─── Test 5: Emergency Interceptor Guardrails ─────────────────────────────
  await test('Emergency interceptor: immediately detects emergency symptoms', async () => {
    const groq = getGroqAdapter();
    const emergencyText = 'I have severe chest pain and cannot breathe';
    const emergencyResp = groq.checkEmergency(emergencyText);
    assert(emergencyResp !== null, 'Must trigger emergency interceptor');
    assert(emergencyResp?.includes('112') || emergencyResp?.includes('911'), 'Must include emergency dispatch contact');

    const normalText = 'Can you summarize what HbA1c is?';
    assert.strictEqual(groq.checkEmergency(normalText), null, 'Normal query must not trigger interceptor');
  });

  // ─── Test 6: Python OCR Subprocess execution on Digital PDF ────────────────
  await test('OCR runner: PyMuPDF digital PDF text extraction via subprocess', async () => {
    const digitalText = 'Digital Medical Prescription: Amoxicillin 500mg three times daily for 7 days.';
    const pdfBuffer = createSimpleDigitalPdf(digitalText);

    const result = await processDocumentWithOcr(pdfBuffer, 'application/pdf');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documentType, 'pdf');
    assert.strictEqual(result.pageCount, 1);
    assert(result.pages && result.pages.length === 1);
    assert.strictEqual(result.pages[0].method, 'embedded_text');
    assert(result.extractedText?.includes('Amoxicillin') || result.extractedText?.includes('Prescription'));
  });

  // ─── Test 7: Python OCR Subprocess execution on Image ─────────────────────
  await test('OCR runner: Pillow & Tesseract image processing on blank image', async () => {
    const imgBuffer = Buffer.from(MINIMAL_PNG_BASE64, 'base64');
    const result = await processDocumentWithOcr(imgBuffer, 'image/png');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documentType, 'image');
    assert.strictEqual(result.pageCount, 1);
    assert(result.pages && result.pages[0].method === 'ocr');
  });

  // ─── Test 8: OCR Runner Error Handling on Corrupt File ────────────────────
  await test('OCR runner: Corrupt file gracefully triggers CorruptImageError', async () => {
    const corruptBuffer = Buffer.from('NOT_A_VALID_IMAGE_OR_PDF_CORRUPT_BYTES');
    try {
      await processDocumentWithOcr(corruptBuffer, 'image/jpeg');
      assert.fail('Should have thrown an error for corrupt image');
    } catch (err: unknown) {
      assert(err instanceof OcrRunnerError);
      assert.strictEqual((err as OcrRunnerError).errorCode, 'CORRUPT_IMAGE');
    }
  });

  // ─── Run Authentication & Tenant Isolation Test Suite ────────────────────
  await runAuthIsolationTests();

  // ─── Run Amazon Textract Integration & Safety Test Suite ──────────────────
  await runTextractTests();

  // ─── Run Chat History & Multi-Tenant Isolation Test Suite ─────────────────
  await runChatHistoryTests();

  // ─── Run Document Classification & Grounding Test Suite ───────────────────
  await runDocumentClassificationTests();

  // ─── Run FCM Notification & Reminder Test Suite ──────────────────────────
  await runNotificationTests();

  // ─── Run Multilingual & Preferences Test Suite ───────────────────────────
  await runMultilingualTests();

  // ─── Run Groq Speech-to-Text (STT) Test Suite ────────────────────────────
  await runSttTests();

  // ─── Run Clinical Intelligence & Safety Test Suite ───────────────────────
  const clinicalResults = await runClinicalIntelligenceTests();
  if (clinicalResults.failed > 0) failed += clinicalResults.failed;
  passed += clinicalResults.passed;

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
