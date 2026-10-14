/**
 * HealthSaathi AI - Prescription Drug-Drug Interaction Safety Engine
 *
 * Scans active patient prescriptions and identifies high-risk clinical interactions (DDIs).
 * Provides severity badges, pharmacological rationale, and patient-safe talking points for clinicians.
 */

export const CLINICAL_INTERACTIONS = [
  {
    id: 'warfarin-aspirin',
    drugsA: ['warfarin', 'coumadin', 'jantoven', 'marevan'],
    drugsB: ['aspirin', 'ecosprin', 'disprin', 'acetylsalicylic', 'ibuprofen', 'brufen', 'advil', 'motrin', 'naproxen', 'aleve', 'diclofenac', 'voveran'],
    severity: 'CRITICAL',
    title: 'Severe Bleeding Hazard (Anticoagulant + Antiplatelet/NSAID)',
    mechanism: 'Concurrent use of Warfarin with Aspirin or NSAIDs impairs platelet aggregation and damages gastric mucosa, causing a synergistic multiplication of major gastrointestinal and systemic hemorrhage risk.',
    clinicalAction: 'Immediately alert your prescribing physician or cardiologist. Do not discontinue your blood thinner without clinical supervision, but confirm whether this combination is intentional with gastroprotective co-therapy.',
    doctorQuestion: 'Ask your doctor: "Should I be taking Aspirin together with Warfarin, and do I need a gastroprotective medicine (e.g., PPI) or closer INR monitoring?"',
  },
  {
    id: 'acei-k-sparing',
    drugsA: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'losartan', 'telmisartan', 'valsartan'],
    drugsB: ['spironolactone', 'aldactone', 'eplerenone', 'amiloride', 'potassium chloride', 'potassium'],
    severity: 'MAJOR',
    title: 'Severe Hyperkalemia Risk (ACEi/ARB + Potassium-Sparing Diuretic)',
    mechanism: 'Both classes suppress aldosterone signaling, leading to cumulative retention of serum potassium which can trigger dangerous cardiac dysrhythmias.',
    clinicalAction: 'Ensure regular blood tests for serum potassium and renal function (creatinine/eGFR). Report any muscle weakness, numbness, or palpitations immediately.',
    doctorQuestion: 'Ask your doctor: "When was my last serum potassium check, and is my current level safe with this combination?"',
  },
  {
    id: 'statin-macrolide',
    drugsA: ['simvastatin', 'zocor', 'atorvastatin', 'lipitor', 'lovastatin'],
    drugsB: ['clarithromycin', 'biaxin', 'erythromycin', 'itraconazole', 'ketoconazole', 'gemfibrozil'],
    severity: 'MAJOR',
    title: 'Rhabdomyolysis & Muscle Toxicity (Statin + CYP3A4 Inhibitor)',
    mechanism: 'Potent CYP3A4 inhibition drastically raises systemic statin exposure (up to 5-10x), risking severe skeletal muscle destruction (rhabdomyolysis) and acute renal failure.',
    clinicalAction: 'Statins are usually temporarily paused during acute macrolide antibiotic courses. Contact your prescriber immediately if experiencing muscle aches, weakness, or dark tea-colored urine.',
    doctorQuestion: 'Ask your doctor: "Should I temporarily suspend my statin while finishing this antibiotic course?"',
  },
  {
    id: 'metformin-contrast',
    drugsA: ['metformin', 'glycomet', 'glucophage', 'janumet'],
    drugsB: ['iodinated contrast', 'contrast dye', 'iohexol', 'iodixanol'],
    severity: 'MAJOR',
    title: 'Lactic Acidosis Hazard (Metformin + Contrast Media)',
    mechanism: 'Radiological iodinated contrast can induce acute renal impairment, leading to toxic metformin retention and life-threatening lactic acidosis.',
    clinicalAction: 'Metformin must typically be withheld at the time of or prior to iodinated contrast procedures and reinstituted only after 48 hours once renal stability is verified.',
    doctorQuestion: 'Ask your radiologist/physician: "Have we scheduled the safe 48-hour pause for Metformin around my imaging study?"',
  },
  {
    id: 'ssri-tramadol',
    drugsA: ['tramadol', 'ultram', 'meperidine', 'tapentadol'],
    drugsB: ['citalopram', 'escitalopram', 'sertraline', 'fluoxetine', 'paroxetine', 'venlafaxine', 'duloxetine'],
    severity: 'MAJOR',
    title: 'Serotonin Syndrome Warning (Opioid Analgesic + SSRI/SNRI)',
    mechanism: 'Both Tramadol and serotonergic antidepressants increase central serotonin availability, potentially precipitating central serotonin toxicity (hyperreflexia, clonus, fever, delirium).',
    clinicalAction: 'Seek prompt emergency care if developing rapid heart rate, severe restlessness, shivering, muscle stiffness, or confusion.',
    doctorQuestion: 'Ask your doctor: "Is there a non-serotonergic analgesic alternative for my pain relief?"',
  },
  {
    id: 'clopidogrel-omeprazole',
    drugsA: ['clopidogrel', 'plavix'],
    drugsB: ['omeprazole', 'prilosec', 'omez', 'esomeprazole', 'nexium'],
    severity: 'MODERATE',
    title: 'Reduced Antiplatelet Efficacy (Clopidogrel + CYP2C19 Inhibitor)',
    mechanism: 'Omeprazole competitively inhibits CYP2C19 bioactivation of Clopidogrel, lowering circulating active antiplatelet metabolites and raising stent/thrombus risk.',
    clinicalAction: 'Consult your cardiologist. Guidelines often recommend substituting Pantoprazole or an H2 blocker (e.g. Famotidine) which does not inhibit CYP2C19.',
    doctorQuestion: 'Ask your doctor: "Can we switch my acid-reducer to Pantoprazole so it does not interfere with Clopidogrel?"',
  },
  {
    id: 'levothyroxine-minerals',
    drugsA: ['levothyroxine', 'thyronorm', 'eltroxin', 'synthroid'],
    drugsB: ['calcium', 'calcium carbonate', 'ferrous sulfate', 'iron', 'livogen'],
    severity: 'MODERATE',
    title: 'Impaired Thyroid Absorption (Levothyroxine + Mineral Cations)',
    mechanism: 'Polyvalent cations (calcium and iron) form insoluble chelates with levothyroxine in the stomach and duodenum, significantly reducing hormone bioavailability.',
    clinicalAction: 'Space doses apart by at least 4 hours. Take levothyroxine in the morning on an empty stomach with plain water, and take calcium/iron supplements with lunch or dinner.',
    doctorQuestion: 'Ask your doctor: "Am I leaving enough hours between my thyroid medicine and my calcium/iron supplements?"',
  },
]

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
}

function matchesKeywords(medName, keywords) {
  const norm = normalizeName(medName)
  if (!norm) return false
  return keywords.some((kw) => {
    const kwNorm = normalizeName(kw)
    return norm.includes(kwNorm) || kwNorm.includes(norm)
  })
}

/**
 * Scan active medicines and return detected interactions.
 */
export function detectDrugInteractions(medicines) {
  if (!Array.isArray(medicines) || medicines.length < 2) return []

  // Check current / active medications
  const activeMeds = medicines.filter(
    (m) => !m.status || String(m.status).toLowerCase() === 'current' || String(m.status).toLowerCase() === 'active'
  )

  const detected = []
  const recorded = new Set()

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const medA = activeMeds[i]
      const medB = activeMeds[j]

      for (const rule of CLINICAL_INTERACTIONS) {
        const aMatchesA = matchesKeywords(medA.name, rule.drugsA)
        const bMatchesB = matchesKeywords(medB.name, rule.drugsB)

        const aMatchesB = matchesKeywords(medA.name, rule.drugsB)
        const bMatchesA = matchesKeywords(medB.name, rule.drugsA)

        if ((aMatchesA && bMatchesB) || (aMatchesB && bMatchesA)) {
          const key = [rule.id, medA.name, medB.name].sort().join('::')
          if (!recorded.has(key)) {
            recorded.add(key)
            detected.push({
              id: rule.id,
              drugA: aMatchesA ? medA : medB,
              drugB: aMatchesA ? medB : medA,
              severity: rule.severity,
              title: rule.title,
              mechanism: rule.mechanism,
              clinicalAction: rule.clinicalAction,
              doctorQuestion: rule.doctorQuestion,
            })
          }
        }
      }
    }
  }

  return detected
}
