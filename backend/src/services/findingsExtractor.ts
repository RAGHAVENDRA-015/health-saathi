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
  criticalLow?: number;
  criticalHigh?: number;
  status: FindingStatus;
}

interface TestPattern {
  category: string;
  testName: string;
  regex: RegExp;
  unit: string;
  defaultLow?: number;
  defaultHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  isBloodPressure?: boolean;
}

const COMMON_TEST_PATTERNS: TestPattern[] = [
  {
    category: 'Metabolic & Diabetes',
    testName: 'Fasting Blood Glucose',
    regex: /(?:fasting\s+blood\s+(?:glucose|sugar)|fbs)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl|mmol\/l)?/i,
    unit: 'mg/dL',
    defaultLow: 70,
    defaultHigh: 100,
    criticalLow: 54,
    criticalHigh: 250,
  },
  {
    category: 'Metabolic & Diabetes',
    testName: 'HbA1c (Glycated Hemoglobin)',
    regex: /(?:hba1c|glycated\s+hemoglobin)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(%|percent)?/i,
    unit: '%',
    defaultLow: 4.0,
    defaultHigh: 5.7,
    criticalHigh: 10.0,
  },
  {
    category: 'Lipid Profile',
    testName: 'Total Cholesterol',
    regex: /(?:total\s+cholesterol|cholesterol\s+total)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl)?/i,
    unit: 'mg/dL',
    defaultLow: 125,
    defaultHigh: 200,
    criticalHigh: 300,
  },
  {
    category: 'Kidney Function',
    testName: 'Serum Creatinine',
    regex: /(?:serum\s+creatinine|creatinine)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl)?/i,
    unit: 'mg/dL',
    defaultLow: 0.7,
    defaultHigh: 1.3,
    criticalHigh: 4.0,
  },
  {
    category: 'Electrolytes',
    testName: 'Serum Potassium',
    regex: /(?:serum\s+potassium|potassium|k\+)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(meq\/l|mmol\/l)?/i,
    unit: 'mEq/L',
    defaultLow: 3.5,
    defaultHigh: 5.1,
    criticalLow: 2.8,
    criticalHigh: 6.2,
  },
  {
    category: 'Complete Blood Count',
    testName: 'Hemoglobin',
    regex: /(?:hemoglobin|hb)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g\/dl)?/i,
    unit: 'g/dL',
    defaultLow: 12.0,
    defaultHigh: 16.0,
    criticalLow: 7.0,
  },
  {
    category: 'Complete Blood Count',
    testName: 'Platelet Count',
    regex: /(?:platelet\s+count|platelets)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(?:[×xX]?10\^?[39]\/?[µu]?l|\/?[µu]l|cells\/cumm|cumm)?/i,
    unit: '×10³/µL',
    defaultLow: 150,
    defaultHigh: 450,
    criticalLow: 50,
  },
  {
    category: 'Vitals',
    testName: 'Blood Pressure',
    regex: /(?:blood\s+pressure|bp)[\s:]*([0-9]{2,3}\s*\/\s*[0-9]{2,3})\s*(mmhg)?/i,
    unit: 'mmHg',
    isBloodPressure: true,
  },
];

/**
 * Scan extracted document text for recognized clinical values and test ranges,
 * automated reference range flagging (NORMAL, HIGH, LOW, CRITICAL).
 */
export function extractClinicalFindings(text: string): ExtractedFinding[] {
  if (!text) return [];

  const findings: ExtractedFinding[] = [];
  const seenTests = new Set<string>();

  for (const pattern of COMMON_TEST_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match && !seenTests.has(pattern.testName)) {
      seenTests.add(pattern.testName);
      const rawValue = match[1].replace(/\s+/g, '');
      const unit = match[2] || pattern.unit;

      let status: FindingStatus = 'NORMAL';

      if (pattern.isBloodPressure) {
        const parts = rawValue.split('/');
        const sys = parseFloat(parts[0]);
        const dia = parseFloat(parts[1]);
        if (!isNaN(sys) && !isNaN(dia)) {
          if (sys >= 180 || dia >= 120) {
            status = 'CRITICAL';
          } else if (sys >= 130 || dia >= 80) {
            status = 'HIGH';
          } else if (sys < 90 || dia < 60) {
            status = 'LOW';
          } else {
            status = 'NORMAL';
          }
        }
      } else {
        const numVal = parseFloat(rawValue);
        if (!isNaN(numVal)) {
          if (pattern.criticalLow !== undefined && numVal <= pattern.criticalLow) {
            status = 'CRITICAL';
          } else if (pattern.criticalHigh !== undefined && numVal >= pattern.criticalHigh) {
            status = 'CRITICAL';
          } else if (pattern.defaultLow !== undefined && numVal < pattern.defaultLow) {
            status = 'LOW';
          } else if (pattern.defaultHigh !== undefined && numVal > pattern.defaultHigh) {
            status = 'HIGH';
          } else if (pattern.defaultLow !== undefined && pattern.defaultHigh !== undefined) {
            status = 'NORMAL';
          }
        }
      }

      let refRange: string | undefined;
      if (pattern.isBloodPressure) {
        refRange = '90/60 - 120/80 mmHg';
      } else if (pattern.defaultLow !== undefined && pattern.defaultHigh !== undefined) {
        refRange = `${pattern.defaultLow} - ${pattern.defaultHigh} ${unit}`;
      }

      findings.push({
        category: pattern.category,
        testName: pattern.testName,
        result: rawValue,
        unit,
        referenceRange: refRange,
        referenceLow: pattern.defaultLow,
        referenceHigh: pattern.defaultHigh,
        criticalLow: pattern.criticalLow,
        criticalHigh: pattern.criticalHigh,
        status,
      });
    }
  }

  return findings;
}
