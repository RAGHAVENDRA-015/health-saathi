/**
 * HealthSaathi AI - Clinical Intelligence Automated Test Suite
 *
 * Verifies:
 * 1. Automated Reference Range & Critical Value Flagging (NORMAL, HIGH, LOW, CRITICAL)
 * 2. Prescription Drug-Drug Interaction Safety Engine (Warfarin + Aspirin, etc.)
 */

import assert from 'assert';
import { extractClinicalFindings } from '../src/services/findingsExtractor';
import { checkDrugInteractions } from '../src/services/drugInteractionService';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  ▶ ${name}... ✅ PASS`);
    passed++;
  } catch (err) {
    console.error(`  ▶ ${name}... ❌ FAIL:`, err);
    failed++;
    throw err;
  }
}

export async function runClinicalIntelligenceTests(): Promise<{ passed: number; failed: number }> {
  console.log(`\n🩺 Starting Clinical Intelligence & Safety Test Suite...\n`);

  // ─── 1. Automated Reference Range Flagging Tests ─────────────────────────
  test('Reference Range: Fasting Blood Glucose 145 mg/dL is flagged HIGH against 70–99 normal range', () => {
    const reportText = `Patient Fasting Blood Glucose: 145 mg/dL.`;
    const findings = extractClinicalFindings(reportText);
    const fbs = findings.find((f) => f.testName === 'Fasting Blood Glucose');
    assert(fbs, 'Fasting Blood Glucose must be extracted');
    assert.strictEqual(fbs.result, '145');
    assert.strictEqual(fbs.status, 'HIGH', '145 mg/dL must be flagged HIGH');
    assert(fbs.referenceRange?.includes('70'), 'Reference range must include 70');
  });

  test('Reference Range: Fasting Blood Glucose 88 mg/dL is flagged NORMAL', () => {
    const reportText = `Fasting Blood Glucose: 88 mg/dL.`;
    const findings = extractClinicalFindings(reportText);
    const fbs = findings.find((f) => f.testName === 'Fasting Blood Glucose');
    assert.strictEqual(fbs?.status, 'NORMAL', '88 mg/dL must be flagged NORMAL');
  });

  test('Reference Range: Severe Hyperglycemia (310 mg/dL) is flagged CRITICAL', () => {
    const reportText = `Fasting Blood Sugar: 310 mg/dL. Urgent review required.`;
    const findings = extractClinicalFindings(reportText);
    const fbs = findings.find((f) => f.testName === 'Fasting Blood Glucose');
    assert.strictEqual(fbs?.status, 'CRITICAL', '310 mg/dL must be flagged CRITICAL (>250)');
  });

  test('Reference Range: Severe Hypoglycemia (48 mg/dL) is flagged CRITICAL', () => {
    const reportText = `FBS: 48 mg/dL. Patient feeling dizzy.`;
    const findings = extractClinicalFindings(reportText);
    const fbs = findings.find((f) => f.testName === 'Fasting Blood Glucose');
    assert.strictEqual(fbs?.status, 'CRITICAL', '48 mg/dL must be flagged CRITICAL (<=54)');
  });

  test('Reference Range: HbA1c 7.4% is flagged HIGH, HbA1c 11.2% is flagged CRITICAL', () => {
    const findingsHigh = extractClinicalFindings('HbA1c: 7.4 %');
    assert.strictEqual(findingsHigh[0]?.status, 'HIGH');

    const findingsCrit = extractClinicalFindings('Glycated Hemoglobin: 11.2 %');
    assert.strictEqual(findingsCrit[0]?.status, 'CRITICAL');
  });

  test('Reference Range: Blood Pressure 130/85 is flagged HIGH, 195/125 is flagged CRITICAL', () => {
    const findingsHigh = extractClinicalFindings('Blood Pressure: 130/85 mmHg');
    assert.strictEqual(findingsHigh[0]?.status, 'HIGH');

    const findingsCrit = extractClinicalFindings('BP: 195/125 mmHg');
    assert.strictEqual(findingsCrit[0]?.status, 'CRITICAL');
  });

  test('Reference Range: Serum Potassium 6.5 mEq/L is flagged CRITICAL', () => {
    const findings = extractClinicalFindings('Serum Potassium: 6.5 mEq/L');
    assert.strictEqual(findings[0]?.status, 'CRITICAL');
  });

  // ─── 2. Prescription Drug-Drug Interaction Safety Tests ──────────────────
  test('DDI Warning: Warfarin + Aspirin is detected with CRITICAL Bleeding Hazard', () => {
    const activePrescriptions = [
      { name: 'Warfarin', strength: '5 mg', status: 'current' },
      { name: 'Aspirin (Ecosprin)', strength: '75 mg', status: 'current' },
      { name: 'Cetirizine', strength: '10 mg', status: 'current' },
    ];
    const interactions = checkDrugInteractions(activePrescriptions);
    assert.strictEqual(interactions.length, 1, 'Should detect exactly 1 dangerous interaction');
    assert.strictEqual(interactions[0].id, 'warfarin-aspirin');
    assert.strictEqual(interactions[0].severity, 'CRITICAL');
    assert(interactions[0].title.includes('Bleeding Hazard'));
    assert(interactions[0].mechanism.includes('platelet'));
  });

  test('DDI Warning: Lisinopril + Spironolactone is detected with MAJOR Hyperkalemia Risk', () => {
    const activePrescriptions = [
      { name: 'Lisinopril', strength: '10 mg', status: 'current' },
      { name: 'Spironolactone', strength: '25 mg', status: 'current' },
    ];
    const interactions = checkDrugInteractions(activePrescriptions);
    assert.strictEqual(interactions.length, 1);
    assert.strictEqual(interactions[0].id, 'acei-k-sparing');
    assert.strictEqual(interactions[0].severity, 'MAJOR');
    assert(interactions[0].title.includes('Hyperkalemia'));
  });

  test('DDI Warning: Simvastatin + Clarithromycin is detected with Rhabdomyolysis Hazard', () => {
    const activePrescriptions = [
      { name: 'Simvastatin', strength: '20 mg', status: 'active' },
      { name: 'Clarithromycin', strength: '500 mg', status: 'active' },
    ];
    const interactions = checkDrugInteractions(activePrescriptions);
    assert.strictEqual(interactions.length, 1);
    assert.strictEqual(interactions[0].id, 'statin-macrolide');
    assert(interactions[0].mechanism.includes('CYP3A4'));
  });

  test('DDI Safety: Compatible medications produce ZERO interactions', () => {
    const safePrescriptions = [
      { name: 'Cetirizine', strength: '10 mg', status: 'current' },
      { name: 'Vitamin D3', strength: '60,000 IU', status: 'current' },
      { name: 'Paracetamol', strength: '500 mg', status: 'current' },
    ];
    const interactions = checkDrugInteractions(safePrescriptions);
    assert.strictEqual(interactions.length, 0, 'Safe medications must not trigger false positives');
  });

  test('DDI Safety: Discontinued / Past medications do not trigger active alert', () => {
    const medsWithPastWarfarin = [
      { name: 'Warfarin', strength: '5 mg', status: 'past' }, // Discontinued!
      { name: 'Aspirin', strength: '75 mg', status: 'current' },
    ];
    const interactions = checkDrugInteractions(medsWithPastWarfarin);
    assert.strictEqual(interactions.length, 0, 'Past medication must not trigger active interaction alert');
  });

  console.log(`\n========================================`);
  console.log(`Clinical Intelligence Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  return { passed, failed };
}
