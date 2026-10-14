/**
 * HealthSaathi AI - Clinical Findings Extractor
 *
 * Extracts structured laboratory metrics and vitals from medical text
 * with reference ranges, units, and clinical status flags (NORMAL, HIGH, LOW).
 */

import { FindingStatus } from '../types/models';

export interface ExtractedFinding {
  category: string;
  testName: string;
  result: string;
  unit?: string;
  referenceRange?: string;
  referenceLow?: number;
  referenceHigh?: number;
  status: FindingStatus;
}

interface TestPattern {
  category: string;
  testName: string;
  regex: RegExp;
  unit: string;
  defaultLow?: number;
  defaultHigh?: number;
}

const COMMON_TEST_PATTERNS: TestPattern[] = [
  {
    category: 'Metabolic & Diabetes',
    testName: 'Fasting Blood Glucose',
    regex: /(?:fasting\s+blood\s+(?:glucose|sugar)|fbs)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl|mmol\/l)?/i,
    unit: 'mg/dL',
    defaultLow: 70,
    defaultHigh: 100,
  },
  {
    category: 'Metabolic & Diabetes',
    testName: 'HbA1c (Glycated Hemoglobin)',
    regex: /(?:hba1c|glycated\s+hemoglobin)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(%|percent)?/i,
    unit: '%',
    defaultLow: 4.0,
    defaultHigh: 5.7,
  },
  {
    category: 'Lipid Profile',
    testName: 'Total Cholesterol',
    regex: /(?:total\s+cholesterol|cholesterol\s+total)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl)?/i,
    unit: 'mg/dL',
    defaultLow: 125,
    defaultHigh: 200,
  },
  {
    category: 'Kidney Function',
    testName: 'Serum Creatinine',
    regex: /(?:serum\s+creatinine|creatinine)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl)?/i,
    unit: 'mg/dL',
    defaultLow: 0.7,
    defaultHigh: 1.3,
  },
  {
    category: 'Complete Blood Count',
    testName: 'Hemoglobin',
    regex: /(?:hemoglobin|hb)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g\/dl)?/i,
    unit: 'g/dL',
    defaultLow: 12.0,
    defaultHigh: 16.0,
  },
  {
    category: 'Vitals',
    testName: 'Blood Pressure',
    regex: /(?:blood\s+pressure|bp)[\s:]*([0-9]{2,3}\/[0-9]{2,3})\s*(mmhg)?/i,
    unit: 'mmHg',
  },
];

/**
 * Scan extracted document text for recognized clinical values and test ranges.
 */
export function extractClinicalFindings(text: string): ExtractedFinding[] {
  if (!text) return [];

  const findings: ExtractedFinding[] = [];
  const seenTests = new Set<string>();

  for (const pattern of COMMON_TEST_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match && !seenTests.has(pattern.testName)) {
      seenTests.add(pattern.testName);
      const rawValue = match[1];
      const unit = match[2] || pattern.unit;

      let status: FindingStatus = 'NORMAL';
      const numVal = parseFloat(rawValue);

      if (!isNaN(numVal) && pattern.defaultLow !== undefined && pattern.defaultHigh !== undefined) {
        if (numVal < pattern.defaultLow) status = 'LOW';
        else if (numVal > pattern.defaultHigh) status = 'HIGH';
        else status = 'NORMAL';
      }

      const refRange =
        pattern.defaultLow !== undefined && pattern.defaultHigh !== undefined
          ? `${pattern.defaultLow} - ${pattern.defaultHigh} ${unit}`
          : undefined;

      findings.push({
        category: pattern.category,
        testName: pattern.testName,
        result: rawValue,
        unit,
        referenceRange: refRange,
        referenceLow: pattern.defaultLow,
        referenceHigh: pattern.defaultHigh,
        status,
      });
    }
  }

  return findings;
}
