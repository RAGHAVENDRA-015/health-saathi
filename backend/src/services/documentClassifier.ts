/**
 * HealthSaathi AI - Document Classification Service
 *
 * Lightweight, explainable classification of extracted document text.
 * Distinguishes between:
 * - MEDICAL_REPORT: Laboratory results, blood tests, radiology, pathology
 * - PRESCRIPTION: Rx, medication orders, dosages, doctor prescriptions
 * - CLINICAL_SUMMARY: Discharge summaries, doctor consultation notes, clinical letters
 * - OTHER: Non-medical documents (invoices, receipts, resumes, bills, tickets, contracts)
 * - UNKNOWN: Empty, unreadable, or insufficient text (< 30 characters)
 */

export type DocumentClassificationType =
  | 'MEDICAL_REPORT'
  | 'PRESCRIPTION'
  | 'CLINICAL_SUMMARY'
  | 'OTHER'
  | 'UNKNOWN';

export interface DocumentClassificationResult {
  classification: DocumentClassificationType;
  category: DocumentClassificationType;
  isMedicalDocument: boolean;
  confidence: number;
  reason: string;
  reasons: string[];
}

// ─── Classification Keyword Dictionaries ──────────────────────────────────────

const NON_MEDICAL_KEYWORDS = [
  'invoice', 'bill to', 'tax invoice', 'receipt', 'amount due', 'subtotal',
  'total amount', 'payment due', 'gstin', 'gst no', 'vat no', 'order id',
  'purchase order', 'shipping address', 'billing address', 'curriculum vitae',
  'resume', 'work experience', 'education', 'skills', 'employment history',
  'bank statement', 'account balance', 'credit card', 'debit card', 'transaction',
  'boarding pass', 'flight ticket', 'train ticket', 'pnr no', 'hotel reservation',
  'driving license', 'passport', 'voter id', 'pan card', 'aadhaar',
  'lease agreement', 'rental agreement', 'tenancy contract', 'affidavit',
  // Educational, technical, academic, and code-related non-medical documents
  'programming', 'javascript', 'expressjs', 'reactjs', 'node.js', 'mongodb', 'html', 'css',
  'source code', 'repository', 'software', 'computer science', 'algorithm', 'git', 'github',
  'syllabus', 'curriculum', 'lab manual', 'lecture notes', 'textbook', 'chapter', 'tutorial',
  'course outline', 'assignment', 'university', 'college', 'exam', 'semester', 'grade',
];

const PRESCRIPTION_KEYWORDS = [
  'rx', 'prescription', 'prescribed', 'tablet', 'tab.', 'cap.', 'capsule',
  'syrup', 'syp.', 'dosage', 'od', 'bd', 'tds', 'qid', 'hs', 'po',
  'mg', 'mcg', 'ml', 'dispense', 'refill', 'sig:', 'take 1', 'take 2',
  'after food', 'before food', 'after meals', 'before meals', 'dr.', 'doctor',
  'physician', 'clinic', 'hospital', 'patient name', 'reg no',
];

const MEDICAL_REPORT_KEYWORDS = [
  'laboratory', 'pathology', 'diagnostic', 'specimen', 'blood test',
  'haematology', 'hematology', 'biochemistry', 'serology', 'microbiology',
  'lipid profile', 'reference range', 'ref range', 'biological reference',
  'observed value', 'result', 'unit', 'mg/dl', 'g/dl', 'mmol/l', 'u/l',
  'investigation', 'radiology', 'x-ray', 'ct scan', 'mri', 'ultrasound',
  'hemoglobin', 'platelet', 'wbc', 'rbc', 'glucose', 'cholesterol',
  'triglycerides', 'creatinine', 'urea', 'bilirubin', 'tsh', 'vitamin d',
];

const CLINICAL_SUMMARY_KEYWORDS = [
  'discharge summary', 'clinical summary', 'admission date', 'discharge date',
  'chief complaint', 'history of present illness', 'past medical history',
  'physical examination', 'systemic examination', 'provisional diagnosis',
  'final diagnosis', 'treatment given', 'course in hospital', 'condition at discharge',
  'advice on discharge', 'follow up advice', 'consultation note', 'inpatient note',
];

/**
 * Classifies document text based on normalized keyword matches and heuristics.
 */
export function classifyDocument(text: string, filename?: string): DocumentClassificationResult {
  const normalizedFilename = (filename || '').toLowerCase();
  const filenameNonMedical = NON_MEDICAL_KEYWORDS.some((kw) => normalizedFilename.includes(kw));
  const filenameMedical = MEDICAL_REPORT_KEYWORDS.some((kw) => normalizedFilename.includes(kw)) ||
    PRESCRIPTION_KEYWORDS.some((kw) => normalizedFilename.includes(kw));

  if (!text || text.trim().length < 30) {
    if (filenameNonMedical) {
      return {
        classification: 'OTHER',
        category: 'OTHER',
        isMedicalDocument: false,
        confidence: 0.6,
        reason: 'Document filename indicates a non-medical administrative file.',
        reasons: ['Document filename indicates a non-medical administrative file.'],
      };
    }
    return {
      classification: 'UNKNOWN',
      category: 'UNKNOWN',
      isMedicalDocument: false,
      confidence: 0.2,
      reason: 'Insufficient readable text extracted to determine document category.',
      reasons: ['Insufficient readable text extracted to determine document category.'],
    };
  }

  const normalized = (text + ' ' + (filename || '')).toLowerCase();

  // Count matches in each category using word boundaries for short terms
  const countMatches = (keywords: string[]): number => {
    let count = 0;
    for (const kw of keywords) {
      if (kw.length <= 4) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(normalized)) {
          count++;
        }
      } else {
        if (normalized.includes(kw)) {
          count++;
        }
      }
    }
    return count;
  };

  const nonMedicalScore = countMatches(NON_MEDICAL_KEYWORDS) + (filenameNonMedical ? 2 : 0);
  const prescriptionScore = countMatches(PRESCRIPTION_KEYWORDS);
  const reportScore = countMatches(MEDICAL_REPORT_KEYWORDS) + (filenameMedical ? 1 : 0);
  const clinicalScore = countMatches(CLINICAL_SUMMARY_KEYWORDS);

  // 1. High non-medical signal
  if (nonMedicalScore >= 2 && nonMedicalScore > reportScore && nonMedicalScore > prescriptionScore && nonMedicalScore > clinicalScore) {
    const reason = `Document contains non-medical administrative/commercial indicators (${nonMedicalScore} keyword matches).`;
    return {
      classification: 'OTHER',
      category: 'OTHER',
      isMedicalDocument: false,
      confidence: Math.min(0.5 + nonMedicalScore * 0.1, 0.95),
      reason,
      reasons: [reason],
    };
  }

  // 2. Clinical summary (discharge / admission notes)
  if (clinicalScore >= 2 && clinicalScore >= reportScore && clinicalScore >= prescriptionScore) {
    const reason = `Document contains clinical summary and hospital care notes (${clinicalScore} matches).`;
    return {
      classification: 'CLINICAL_SUMMARY',
      category: 'CLINICAL_SUMMARY',
      isMedicalDocument: true,
      confidence: Math.min(0.6 + clinicalScore * 0.08, 0.95),
      reason,
      reasons: [reason],
    };
  }

  // 3. Prescription
  if (prescriptionScore >= 3 && prescriptionScore >= reportScore) {
    const reason = `Document contains pharmacy prescription and medication dosing indicators (${prescriptionScore} matches).`;
    return {
      classification: 'PRESCRIPTION',
      category: 'PRESCRIPTION',
      isMedicalDocument: true,
      confidence: Math.min(0.6 + prescriptionScore * 0.08, 0.95),
      reason,
      reasons: [reason],
    };
  }

  // 4. Medical / Laboratory Report
  if (reportScore >= 2) {
    const reason = `Document contains diagnostic laboratory markers and clinical reference ranges (${reportScore} matches).`;
    return {
      classification: 'MEDICAL_REPORT',
      category: 'MEDICAL_REPORT',
      isMedicalDocument: true,
      confidence: Math.min(0.6 + reportScore * 0.08, 0.98),
      reason,
      reasons: [reason],
    };
  }

  // 5. Mild prescription or clinical terms
  if (prescriptionScore >= 1 || clinicalScore >= 1) {
    const cat = prescriptionScore >= clinicalScore ? 'PRESCRIPTION' : 'CLINICAL_SUMMARY';
    const reason = 'Document contains general healthcare clinical references.';
    return {
      classification: cat,
      category: cat,
      isMedicalDocument: true,
      confidence: 0.55,
      reason,
      reasons: [reason],
    };
  }

  // 6. Non-medical single indicators (e.g. invoice, resume)
  if (nonMedicalScore >= 1) {
    const reason = 'Document contains commercial or personal administrative terms without clinical data.';
    return {
      classification: 'OTHER',
      category: 'OTHER',
      isMedicalDocument: false,
      confidence: 0.6,
      reason,
      reasons: [reason],
    };
  }

  // Fallback: Not enough distinct signal
  const reason = 'Document content did not match distinct medical or non-medical category templates.';
  return {
    classification: 'UNKNOWN',
    category: 'UNKNOWN',
    isMedicalDocument: false,
    confidence: 0.4,
    reason,
    reasons: [reason],
  };
}
