export const LAB_STATUSES = {
  normal: { label: 'Within range' },
  low: { label: 'Below range' },
  high: { label: 'Above range' },
  reported: { label: 'Report available' },
  unavailable: { label: 'Range unavailable' },
}

/**
 * Derive a display status only when a numeric result and explicit numeric
 * reference range are available. Non-numeric observations keep their authored
 * demo status and are never guessed from their wording.
 */
export function deriveLabStatus(item) {
  if (!item || typeof item.value !== 'number' || !Number.isFinite(item.value)) {
    return item?.status ?? 'reported'
  }

  const range = String(item.range ?? item.referenceRange ?? '').trim()
  if (!range) return 'unavailable'

  const below = range.match(/^(?:below|less than|<)\s*(-?\d+(?:\.\d+)?)/i)
  if (below) return item.value < Number(below[1]) ? 'normal' : 'high'

  const above = range.match(/^(?:above|greater than|>)\s*(-?\d+(?:\.\d+)?)/i)
  if (above) return item.value > Number(above[1]) ? 'normal' : 'low'

  const interval = range.match(/(-?\d+(?:\.\d+)?)\s*(?:–|—|-|to)\s*(-?\d+(?:\.\d+)?)/i)
  if (interval) {
    const lower = Number(interval[1])
    const upper = Number(interval[2])
    if (item.value < lower) return 'low'
    if (item.value > upper) return 'high'
    return 'normal'
  }

  return item.status ?? 'unavailable'
}

export const mockReports = [
  {
    id: 'rpt-blood-2026-10',
    documentId: 'doc-blood-test',
    title: 'Blood Test Report',
    panel: 'Routine blood panel',
    category: 'blood',
    date: '2026-10-08',
    summary:
      'Routine comprehensive metabolic and hematology panel. Most values sit within standard reference ranges; Vitamin D is slightly below optimal range (28 ng/mL) and fasting triglycerides are mildly elevated (162 mg/dL).',
    suggestion:
      'Vitamin D is below standard optimal levels. Discuss dietary options or appropriate vitamin D supplementation with your doctor.',
    labValues: [
      { id: 'hemoglobin', name: 'Hemoglobin', value: 13.2, unit: 'g/dL', range: '12.0 – 15.5', status: 'normal', icon: 'droplet', featured: true, group: 'Blood count' },
      { id: 'glucose-fasting', name: 'Blood Sugar (Fasting)', value: 92, unit: 'mg/dL', range: '70 – 99', status: 'normal', icon: 'droplets', featured: true, group: 'Metabolic' },
      { id: 'cholesterol-total', name: 'Cholesterol (Total)', value: 189, unit: 'mg/dL', range: 'Below 200', status: 'normal', icon: 'heart', featured: true, group: 'Lipid profile' },
      { id: 'vitamin-d', name: 'Vitamin D', value: 28, unit: 'ng/mL', range: '30 – 100', status: 'low', icon: 'sun', featured: true, group: 'Vitamins' },
      { id: 'wbc', name: 'White Blood Cells', value: 7.1, unit: '×10³/µL', range: '4.0 – 11.0', status: 'normal', icon: 'droplet', group: 'Blood count' },
      { id: 'platelets', name: 'Platelets', value: 245, unit: '×10³/µL', range: '150 – 410', status: 'normal', icon: 'droplet', group: 'Blood count' },
      { id: 'vitamin-b12', name: 'Vitamin B12', value: 412, unit: 'pg/mL', range: '200 – 900', status: 'normal', icon: 'sun', group: 'Vitamins' },
      { id: 'triglycerides', name: 'Triglycerides', value: 162, unit: 'mg/dL', range: 'Below 150', status: 'high', icon: 'heart', group: 'Lipid profile' },
    ],
  },
  {
    id: 'rpt-lipid-2026-07',
    documentId: 'doc-lipid-profile',
    title: 'Lipid Profile',
    panel: 'Lipid profile',
    category: 'blood',
    date: '2026-07-20',
    summary: 'Comprehensive fasting lipid profile evaluating cardiovascular health markers. Total cholesterol and triglycerides are mildly elevated with preserved HDL.',
    suggestion: 'Review lipid results in the context of personal history and overall cardiovascular risk with your clinician.',
    labValues: [
      { id: 'lipid-cholesterol-total', name: 'Cholesterol (Total)', value: 202, unit: 'mg/dL', range: 'Below 200', status: 'high', icon: 'heart', group: 'Lipid profile' },
      { id: 'lipid-triglycerides', name: 'Triglycerides', value: 178, unit: 'mg/dL', range: 'Below 150', status: 'high', icon: 'heart', group: 'Lipid profile' },
      { id: 'hdl', name: 'HDL Cholesterol', value: 42, unit: 'mg/dL', range: '40 – 999', status: 'normal', icon: 'heart', group: 'Lipid profile' },
      { id: 'ldl', name: 'LDL Cholesterol', value: 124, unit: 'mg/dL', range: 'Below 130', status: 'normal', icon: 'heart', group: 'Lipid profile' },
    ],
  },
  {
    id: 'rpt-thyroid-2026-06',
    documentId: 'doc-thyroid',
    title: 'Thyroid Function Test',
    panel: 'Thyroid panel',
    category: 'blood',
    date: '2026-06-11',
    summary: 'Thyroid panel evaluating TSH, Free T3 and T4 levels to assess metabolic and endocrine regulation. All hormone parameters within reference boundaries.',
    suggestion: 'Interpret thyroid results using laboratory reference ranges and clinical symptom evaluation.',
    labValues: [
      { id: 'tsh', name: 'TSH', value: 2.1, unit: 'µIU/mL', range: '0.4 – 4.0', status: 'normal', icon: 'droplet', group: 'Thyroid' },
      { id: 't3', name: 'Total T3', value: 1.2, unit: 'ng/mL', range: '0.8 – 2.0', status: 'normal', icon: 'droplet', group: 'Thyroid' },
      { id: 't4', name: 'Total T4', value: 8.1, unit: 'µg/dL', range: '5.0 – 12.0', status: 'normal', icon: 'droplet', group: 'Thyroid' },
    ],
  },
  {
    id: 'rpt-liver-2026-04',
    documentId: 'doc-lft',
    title: 'Liver Function Test',
    panel: 'Liver function panel',
    category: 'blood',
    date: '2026-04-14',
    summary: 'Standard liver enzyme panel assessing AST, ALT, and Total Bilirubin. All hepatic markers within optimal physiological ranges.',
    suggestion: 'Review liver panel results during routine follow-up with your healthcare provider.',
    labValues: [
      { id: 'alt', name: 'ALT (SGPT)', value: 36, unit: 'U/L', range: '7 – 56', status: 'normal', icon: 'droplet', group: 'Liver panel' },
      { id: 'ast', name: 'AST (SGOT)', value: 30, unit: 'U/L', range: '10 – 40', status: 'normal', icon: 'droplet', group: 'Liver panel' },
      { id: 'bilirubin', name: 'Total Bilirubin', value: 0.8, unit: 'mg/dL', range: '0.1 – 1.2', status: 'normal', icon: 'droplet', group: 'Liver panel' },
    ],
  },
  {
    id: 'rpt-kidney-2026-03',
    documentId: 'doc-kft',
    title: 'Kidney Function Test',
    panel: 'Kidney function panel',
    category: 'blood',
    date: '2026-03-09',
    summary: 'Renal function panel measuring serum creatinine, urea nitrogen, and estimated glomerular filtration rate (eGFR). Healthy overall filtration capacity.',
    suggestion: 'Maintain good daily hydration and review renal indicators at your next wellness visit.',
    labValues: [
      { id: 'creatinine', name: 'Creatinine', value: 0.9, unit: 'mg/dL', range: '0.6 – 1.3', status: 'normal', icon: 'droplet', group: 'Kidney panel' },
      { id: 'urea', name: 'Urea', value: 25, unit: 'mg/dL', range: '7 – 20', status: 'high', icon: 'droplet', group: 'Kidney panel' },
      { id: 'egfr', name: 'eGFR', value: 96, unit: 'mL/min/1.73m²', range: '60 – 999', status: 'normal', icon: 'droplet', group: 'Kidney panel' },
    ],
  },
  {
    id: 'rpt-urinalysis-2026-02',
    documentId: 'doc-urinalysis',
    title: 'Urinalysis Report',
    panel: 'Urinalysis',
    category: 'urine',
    date: '2026-02-02',
    summary: 'Routine urinalysis examination screening for protein, glucose, pH balance, and specific gravity. No pathological markers identified.',
    suggestion: 'Urinalysis parameters remain clear and negative for microalbuminuria or infection indicators.',
    labValues: [
      { id: 'urine-specific-gravity', name: 'Specific Gravity', value: 1.02, unit: '', range: '1.005 – 1.03', status: 'normal', icon: 'droplets', group: 'Urinalysis' },
      { id: 'urine-ph', name: 'Urine pH', value: 6, unit: '', range: '4.5 – 8.0', status: 'normal', icon: 'droplets', group: 'Urinalysis' },
      { id: 'urine-protein', name: 'Protein', value: 'Negative', unit: '', range: 'Negative', status: 'normal', icon: 'droplets', group: 'Urinalysis' },
      { id: 'urine-glucose', name: 'Glucose', value: 'Negative', unit: '', range: 'Negative', status: 'normal', icon: 'droplets', group: 'Urinalysis' },
    ],
  },
  {
    id: 'rpt-ct-chest-2026-10',
    documentId: 'doc-ct-chest',
    title: 'CT Scan Report',
    panel: 'Chest imaging',
    category: 'imaging',
    date: '2026-10-02',
    summary: 'Contrast-enhanced chest computed tomography scan. Clear pulmonary parenchyma without focal consolidation or pleural effusion.',
    suggestion: 'Review the radiologist’s official report and imaging findings with your ordering physician.',
    labValues: [
      { id: 'ct-summary', name: 'Report impression', value: 'Clear pulmonary fields', unit: '', range: 'Normal morphology', status: 'reported', icon: 'heart', group: 'Imaging' },
    ],
  },
  {
    id: 'rpt-xray-knee-2026-08',
    documentId: 'doc-xray-knee',
    title: 'X-Ray Report',
    panel: 'X-ray imaging',
    category: 'other',
    date: '2026-08-03',
    summary: 'Bilateral knee diagnostic radiograph evaluating joint space congruency and osseous structures. Mild degenerative changes without acute fracture.',
    suggestion: 'Review official radiologic notes with your orthopedic specialist or physician.',
    labValues: [
      { id: 'xray-summary', name: 'Report impression', value: 'Mild degenerative changes', unit: '', range: 'Age-appropriate', status: 'reported', icon: 'heart', group: 'Other reports' },
    ],
  },
]

export const organFocusAreas = [
  {
    id: 'brain',
    title: 'Brain Health Insights',
    description: 'Understand neurological reports with AI.',
    image: '/images/brain.png',
    longDescription:
      'Neurology consult notes, MRI and EEG summaries will appear here, explained in plain language.',
  },
  {
    id: 'liver',
    title: 'Liver Function Analysis',
    description: 'Get clear explanations of liver test results.',
    image: '/images/liver.png',
    longDescription: 'Liver function panels such as SGOT, SGPT and bilirubin, tracked over time.',
  },
  {
    id: 'kidney',
    title: 'Kidney Health Monitoring',
    description: 'Track and interpret your kidney reports.',
    image: '/images/kidney.png',
    longDescription: 'Creatinine, urea and eGFR trends from your kidney function tests.',
  },
  {
    id: 'heart',
    title: 'Heart Health Check',
    description: 'Analyze ECG, heart rate and cardiac reports.',
    image: '/images/heart.png',
    longDescription: 'ECGs, lipid profiles and cardiac imaging gathered in one place.',
  },
]

export const mockMedicines = [
  { id: 'med-cetirizine', name: 'Cetirizine 10 mg', purpose: 'Seasonal allergy', schedule: 'Once daily at night' },
  { id: 'med-vitamin-d3', name: 'Vitamin D3 60,000 IU', purpose: 'Vitamin D supplementation', schedule: 'Once weekly' },
  { id: 'med-naproxen', name: 'Naproxen 250 mg', purpose: 'Migraine relief', schedule: 'As needed' },
]
