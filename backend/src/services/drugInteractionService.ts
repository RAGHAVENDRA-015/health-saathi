/**
 * HealthSaathi AI - Clinical Drug-Drug Interaction Service
 *
 * Scans active patient prescriptions and identifies potential adverse drug-drug interactions (DDIs)
 * with clinical risk tiers (CRITICAL, MAJOR, MODERATE), pharmacological mechanisms, and
 * actionable patient/clinician guidance.
 */

export type DdiSeverity = 'CRITICAL' | 'MAJOR' | 'MODERATE';

export interface ClinicalDrugInteractionRule {
  id: string;
  drugsA: string[];
  drugsB: string[];
  severity: DdiSeverity;
  title: string;
  mechanism: string;
  clinicalAction: string;
  doctorQuestion: string;
}

export interface DetectedInteraction {
  id: string;
  drugA: string;
  drugB: string;
  severity: DdiSeverity;
  title: string;
  mechanism: string;
  clinicalAction: string;
  doctorQuestion: string;
}

export const CLINICAL_INTERACTION_RULES: ClinicalDrugInteractionRule[] = [
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
    title: 'Severe Hyperkalemia Risk (ACEi/ARB + Potassium-Sparing Agent)',
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
    id: 'levothyroxine-calcium-iron',
    drugsA: ['levothyroxine', 'thyronorm', 'eltroxin', 'synthroid'],
    drugsB: ['calcium', 'calcium carbonate', 'ferrous sulfate', 'iron', 'livogen'],
    severity: 'MODERATE',
    title: 'Impaired Thyroid Absorption (Levothyroxine + Mineral Cations)',
    mechanism: 'Polyvalent cations (calcium and iron) form insoluble chelates with levothyroxine in the stomach and duodenum, significantly reducing hormone bioavailability.',
    clinicalAction: 'Space doses apart by at least 4 hours. Take levothyroxine in the morning on an empty stomach with plain water, and take calcium/iron supplements with lunch or dinner.',
    doctorQuestion: 'Ask your doctor: "Am I leaving enough hours between my thyroid medicine and my calcium/iron supplements?"',
  },
];

function normalizeDrugName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

function matchesDrugKeywords(medName: string, keywords: string[]): boolean {
  const normalized = normalizeDrugName(medName);
  return keywords.some((kw) => {
    const kwNorm = normalizeDrugName(kw);
    // Word boundary or substring match
    return normalized.includes(kwNorm) || kwNorm.includes(normalized);
  });
}

/**
 * Scans an array of active medication names/objects and returns all detected adverse interactions.
 */
export function checkDrugInteractions(
  medicines: Array<{ name: string; strength?: string; notes?: string; status?: string }>
): DetectedInteraction[] {
  if (!medicines || medicines.length < 2) return [];

  // Filter to current/active medicines if status field is present
  const activeMeds = medicines.filter(
    (m) => !m.status || m.status.toLowerCase() === 'current' || m.status.toLowerCase() === 'active'
  );

  const interactions: DetectedInteraction[] = [];
  const recordedPairKeys = new Set<string>();

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const medA = activeMeds[i];
      const medB = activeMeds[j];

      for (const rule of CLINICAL_INTERACTION_RULES) {
        const aMatchesA = matchesDrugKeywords(medA.name, rule.drugsA);
        const bMatchesB = matchesDrugKeywords(medB.name, rule.drugsB);

        const aMatchesB = matchesDrugKeywords(medA.name, rule.drugsB);
        const bMatchesA = matchesDrugKeywords(medB.name, rule.drugsA);

        if ((aMatchesA && bMatchesB) || (aMatchesB && bMatchesA)) {
          const pairKey = [rule.id, medA.name, medB.name].sort().join('::');
          if (!recordedPairKeys.has(pairKey)) {
            recordedPairKeys.add(pairKey);
            interactions.push({
              id: rule.id,
              drugA: aMatchesA ? medA.name : medB.name,
              drugB: aMatchesA ? medB.name : medA.name,
              severity: rule.severity,
              title: rule.title,
              mechanism: rule.mechanism,
              clinicalAction: rule.clinicalAction,
              doctorQuestion: rule.doctorQuestion,
            });
          }
        }
      }
    }
  }

  return interactions;
}
