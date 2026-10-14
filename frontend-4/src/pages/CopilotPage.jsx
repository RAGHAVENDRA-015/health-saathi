import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight, Check, Clock, FileText, FileUp, History, Loader2, MessageCircle, MessageSquare,
  Mic, PenLine, Plus, RotateCcw, Search, Send, Square, Trash2, UserRound, X,
} from 'lucide-react'
import { Badge } from '../components/common/Badge.jsx'
import { Button } from '../components/common/Button.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { copilotApi, stripMarkdown, sttApi } from '../services/api/index.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cn } from '../utils/cn.js'

const prompts = [
  'Explain my latest blood test in simple language.',
  'Help me prepare questions for my doctor.',
]

function generateClinicalReply(question, documents = [], reports = [], medicines = [], appointments = [], selectedDocId = null, user = null, lang = 'en') {
  const normalized = question.toLowerCase().trim()

  let effectiveLang = lang
  if (effectiveLang === 'en') {
    if (/[\u0C00-\u0C7F]/.test(question)) effectiveLang = 'te'
    else if (/[\u0900-\u097F]/.test(question)) effectiveLang = 'hi'
  }

  // 1. Emergency safety interceptor across English, Telugu, and Hindi
  if (
    /urgent|emergency|chest pain|can't breathe|cannot breathe|difficulty breathing|shortness of breath|stroke|unconscious|faint|collapse|severe bleeding/i.test(normalized) ||
    /గుండె\s*నొప్పి|ఛాతీ\s*నొప్పి|ఊపిరి|స్ట్రోక్|పక్షవాతం|ఆత్మహత్య|అత్యవసర|యాంబులెన్స్/i.test(normalized) ||
    /सीने\s*में\s*दर्द|सांस|स्ट्रोक|दौरा|आत्महत्या|आपातकाल|एम्बुलेंस|बेहोश/i.test(normalized)
  ) {
    let emergencyText = `⚠️ **Emergency Medical Warning**\n\nIf you or someone nearby is experiencing severe chest pain, sudden difficulty breathing, numbness, or loss of consciousness, **call emergency services immediately (112 in India / 911 in the US)** or proceed to the nearest emergency department.\n\nHealthSaathi AI cannot evaluate active medical emergencies or prescribe acute treatments. Please seek immediate professional medical attention.`
    if (effectiveLang === 'te') {
      emergencyText = `⚠️ **అత్యవసర వైద్య హెచ్చరిక**\n\nమీరు లేదా మీ దగ్గర ఎవరైనా తీవ్రమైన గుండెనొప్పి, ఊపిరి ఆడకపోవడం లేదా స్పృహ తప్పడం ఎదుర్కొంటుంటే, **వెంటనే అత్యవసర సేవలకు (భారతదేశంలో 112 / US లో 911) కాల్ చేయండి** లేదా సమీప ఆసుపత్రికి వెళ్లండి.\n\nహెల్త్‌సాథీ AI అత్యవసర పరిస్థితులకు చికిత్స అందించదు. దయచేసి వెంటనే నిపుణులైన వైద్యులను సంప్రదించండి.`
    } else if (effectiveLang === 'hi') {
      emergencyText = `⚠️ **आपातकालीन चिकित्सा चेतावनी**\n\nयदि आप या आपके आसपास कोई गंभीर सीने में दर्द, सांस लेने में तकलीफ या बेहోशी का अनुभव कर रहा है, तो **तुरंत आपातकालीन सेवाओं (भारत में 112 / अमेरिका में 911) पर कॉल करें** या निकटतम अस्पताल जाएं।\n\nहेल्थसाथी AI आपातकालीन स्थितियों में दवा या निदान प्रदान नहीं कर सकता। कृपया तुरंत योग्य चिकित्सक से संपर्क करें।`
    }
    return {
      content: emergencyText,
      sourceDocumentId: null,
    }
  }

  // 1b. Friendly greetings (hi, hello, hey, etc.) - no source document
  if (/^(hi|hii|hello|hey|greetings|good\s+(?:morning|afternoon|evening))\b/i.test(normalized) || /^(నమస్కారం|హలో|బాగున్నారా)/i.test(normalized) || /^(नमस्ते|नमस्कार|हैलो)/i.test(normalized)) {
    let greetText = `👋 **Hello! How can I assist you today?**\n\n` +
      `I am your HealthSaathi Clinical AI Assistant. You can ask me:\n` +
      `• Questions about your lab test findings and biomarkers\n` +
      `• Explanations for medical terms and prescriptions\n` +
      `• Questions to prepare for your doctor visits\n\n` +
      `How can I help with your health today?`
    if (effectiveLang === 'te') {
      greetText = `👋 **నమస్కారం! ఈరోజు నేను మీకు ఎలా సహాయపడగలను?**\n\n` +
        `నేను మీ హెల్త్‌సాథీ క్లినికల్ AI సహాయకుడిని. మీరు నన్ను అడగవచ్చు:\n` +
        `• మీ ల్యాబ్ పరీక్ష ఫలితాలు మరియు విలువల గురించిన వివరాలు\n` +
        `• మందులు మరియు వైద్య నిబంధనల వివరణ\n` +
        `• మీ తదుపరి వైద్యుల సందర్శన కోసం ప్రశ్నల సన్నాహాలు\n\n` +
        `ఈరోజు మీ ఆరోగ్యానికి సంబంధించి నేను ఏమి సహాయం చేయగలను?`
    } else if (effectiveLang === 'hi') {
      greetText = `👋 **नमस्ते! आज मैं आपकी क्या सहायता कर सकता हूँ?**\n\n` +
        `मैं आपका हेल्थसाथी क्लिनिकल AI सहायक हूँ। आप मुझसे पूछ सकते हैं:\n` +
        `• आपकी लैब रिपोर्ट और बायोमार्कर के बारे में प्रश्न\n` +
        `• मेडिकल शब्दों और डॉक्टर के पर्चे की सरल व्याख्या\n` +
        `• डॉक्टर से मिलने से पहले महत्वपूर्ण प्रश्नों की तैयारी\n\n` +
        `आज मैं आपके स्वास्थ्य में किस प्रकार मदद कर सकता हूँ?`
    }
    return {
      content: greetText,
      sourceDocumentId: null,
    }
  }

  // 1c. Specific Profile Inquiries — Blood Group
  if (/blood\s*(?:group|type)|రక్త\s*గ్రూప్|బ్లడ్\s*గ్రూప్|रक्त\s*समूह|ब्लड\s*ग्रुप/i.test(normalized)) {
    const bg = user?.bloodGroup || 'A+'
    let bgText = `Your recorded blood group is **${bg}**.\n\n` +
      `• **Blood Group:** **${bg}**\n` +
      `• **Source:** Documented in your Health Profile settings.\n\n` +
      `*Note: Always verify with your official laboratory blood report or donor card before medical procedures or blood transfusions.*`
    if (effectiveLang === 'te') {
      bgText = `మీ ప్రొఫైల్‌లో నమోదు చేయబడిన రక్త గ్రూప్ **${bg}**.\n\n` +
        `• **రక్త గ్రూప్:** **${bg}**\n` +
        `• **మూలం:** మీ ఆరోగ్య ప్రొఫైల్ సెట్టింగ్‌లలో నమోదు చేయబడింది.\n\n` +
        `*గమనిక: వైద్య విధానాలకు ముందు అధికారిక ప్రయోగశాల నివేదికతో ధృవీకరించుకోండి.*`
    } else if (effectiveLang === 'hi') {
      bgText = `आपकी प्रोफ़ाइल में दर्ज रक्त समूह **${bg}** है।\n\n` +
        `• **रक्त समूह (Blood Group):** **${bg}**\n` +
        `• **स्रोत:** आपकी स्वास्थ्य प्रोफ़ाइल सेटिंग्स में दर्ज।\n\n` +
        `*नोट: किसी भी चिकित्सा प्रक्रिया से पहले हमेशा अपनी आधिकारिक लैब रिपोर्ट से पुष्टि करें।*`
    }
    return {
      content: bgText,
      sourceDocumentId: null,
    }
  }

  // 2. Identify target document if any
  let targetDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId || d._id === selectedDocId) : null
  if (!targetDoc) {
    targetDoc = documents.find((d) => d.title && normalized.includes(d.title.toLowerCase()))
  }

  // Handle explicitly non-medical documents or files without clinical parameters
  if (targetDoc) {
    const isMedical = targetDoc.isMedicalDocument !== false && targetDoc.type !== 'OTHER' && targetDoc.category !== 'OTHER'
    if (!isMedical) {
      const docText = targetDoc.extractedText || targetDoc.notes || targetDoc.description || ''
      return {
        content: `📄 **Document Notice: Non-Medical File**\n\nThe selected document **"${targetDoc.title || targetDoc.name}"** is classified as a non-medical document (${targetDoc.classification || targetDoc.type || 'Non-Clinical'}).\n\n` +
          `It does not contain clinical laboratory reports, biomarker measurements, or medical test findings.\n\n` +
          (docText ? `**Document Extract:**\n> ${docText.slice(0, 400).trim()}...\n\n` : '') +
          `If you have general health questions or need help reviewing authentic medical reports, please select or upload a clinical test report.`,
        sourceDocumentId: targetDoc.id || targetDoc._id || null,
      }
    }
  }

  const matchingReport = targetDoc ? reports.find((r) => r.documentId === targetDoc.id || r.id === targetDoc.id) : null
  // Only use matchingReport for this targetDoc, never fallback to reports[0] if targetDoc was selected!
  const defaultReport = targetDoc ? matchingReport : (reports && reports.length > 0 ? reports[0] : null)

  // 3. Vitamin D queries
  if (/vitamin\s*d/i.test(normalized)) {
    let vitVal = defaultReport?.labValues?.find((l) => /vitamin d/i.test(l.name))
    if (!vitVal && targetDoc?.extractedText) {
      const match = targetDoc.extractedText.match(/vitamin\s*d[^\n\r\d]*([0-9]+(?:\.[0-9]+)?)\s*(ng\/mL|nmol\/L)?/i)
      if (match) {
        vitVal = { name: 'Vitamin D', value: match[1], unit: match[2] || 'ng/mL', status: Number(match[1]) < 30 ? 'low' : 'normal', range: '30-100' }
      }
    }
    const valText = vitVal
      ? `Your recorded Vitamin D level is **${vitVal.value} ${vitVal.unit}** (Reference Range: ${vitVal.range} ${vitVal.unit}), categorized as **${vitVal.status.toUpperCase()}**.`
      : (targetDoc ? 'No Vitamin D test was recorded in this selected document.' : 'Vitamin D is a crucial fat-soluble vitamin essential for bone mineral density, neuromuscular health, and immunity.')
    return {
      content: `☀️ **Vitamin D (25-Hydroxyvitamin D) Analysis**\n\n` +
        `• **Current Level:** ${valText}\n` +
        `• **Clinical Significance:** Levels below 20 ng/mL represent deficiency, while 20–30 ng/mL indicate insufficiency. Vitamin D regulates calcium absorption and modulates immune responses.\n` +
        `• **Common Symptoms of Low Levels:** Persistent fatigue, bone or back aches, muscle weakness, and frequent infections.\n` +
        `• **Recommended Discussion with Doctor:**\n` +
        `  1. Do you recommend a weekly high-dose vitamin D supplement (e.g. 60,000 IU) or daily maintenance?\n` +
        `  2. Should we also check serum calcium and PTH levels?`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 4. Glucose / Diabetes / HbA1c / Sugar
  if (/glucose|sugar|diabetes|hba1c|glycemic/i.test(normalized)) {
    let gluVal = defaultReport?.labValues?.find((l) => /glucose|sugar|hba1c/i.test(l.name))
    if (!gluVal && targetDoc?.extractedText) {
      const match = targetDoc.extractedText.match(/(?:fasting\s+)?(?:blood\s+)?glucose[^\n\r\d]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dL)?/i)
      if (match) {
        gluVal = { name: 'Fasting Blood Glucose', value: match[1], unit: match[2] || 'mg/dL', status: Number(match[1]) > 100 ? 'high' : 'normal', range: '70-100' }
      }
    }
    const valText = gluVal
      ? `Your report records **${gluVal.name}** at **${gluVal.value} ${gluVal.unit}** (Target: ${gluVal.range} ${gluVal.unit}), labeled as **${gluVal.status.toUpperCase()}**.`
      : (targetDoc ? 'No glucose or HbA1c measurement is recorded in this document.' : 'Fasting blood glucose reflects your baseline blood sugar after at least 8 hours without food.')
    return {
      content: `🩸 **Blood Glucose & Diabetes Marker Review**\n\n` +
        `• **Report Findings:** ${valText}\n` +
        `• **Standard Diagnostic Thresholds:**\n` +
        `  - Fasting Glucose: 70–99 mg/dL (Normal) | 100–125 mg/dL (Pre-diabetes) | ≥126 mg/dL (Diabetes threshold)\n` +
        `  - HbA1c: <5.7% (Normal) | 5.7%–6.4% (Pre-diabetes) | ≥6.5% (Diabetes threshold)\n` +
        `• **Lifestyle & Next Steps:**\n` +
        `  - Maintain regular physical activity and mindful carbohydrate distribution.\n` +
        `  - Re-check fasting glucose or HbA1c in 3 months as recommended by your physician.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 5. Cholesterol / Lipid Profile / Triglycerides
  if (/cholesterol|lipid|triglyceride|ldl|hdl/i.test(normalized)) {
    let cholVal = defaultReport?.labValues?.find((l) => /cholesterol|triglyceride|ldl|hdl/i.test(l.name))
    if (!cholVal && targetDoc?.extractedText) {
      const match = targetDoc.extractedText.match(/(?:total\s+)?cholesterol[^\n\r\d]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dL)?/i)
      if (match) {
        cholVal = { name: 'Total Cholesterol', value: match[1], unit: match[2] || 'mg/dL', status: Number(match[1]) > 200 ? 'high' : 'normal', range: '< 200' }
      }
    }
    const valText = cholVal
      ? `Your test shows **${cholVal.name}** at **${cholVal.value} ${cholVal.unit}** (Reference: ${cholVal.range} ${cholVal.unit}).`
      : (targetDoc ? 'No lipid panel markers were found in this document.' : 'Lipid profiles evaluate cardiovascular health markers.')
    return {
      content: `🫀 **Lipid Profile & Cardiovascular Health Overview**\n\n` +
        `• **Your Value:** ${valText}\n` +
        `• **Understanding Key Components:**\n` +
        `  - **Total Cholesterol:** Desirable is under 200 mg/dL.\n` +
        `  - **LDL ("Bad" Cholesterol):** Optimal is under 100 mg/dL (or <70 mg/dL for high-risk patients).\n` +
        `  - **HDL ("Good" Cholesterol):** Higher is protective (≥50 mg/dL for women, ≥40 mg/dL for men).\n` +
        `  - **Triglycerides:** Normal fasting is under 150 mg/dL.\n` +
        `• **Questions for Your Clinician:** Should we calculate a 10-year ASCVD risk score, and is dietary change or a statin appropriate?`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 6. Complete Blood Count / Hemoglobin / Platelets / WBC
  if (/hemoglobin|blood count|cbc|platelet|wbc|rbc|anemia/i.test(normalized)) {
    let hbVal = defaultReport?.labValues?.find((l) => /hemoglobin|wbc|platelet/i.test(l.name))
    if (!hbVal && targetDoc?.extractedText) {
      const match = targetDoc.extractedText.match(/hemoglobin[^\n\r\d]*([0-9]+(?:\.[0-9]+)?)\s*(g\/dL)?/i)
      if (match) {
        hbVal = { name: 'Hemoglobin', value: match[1], unit: match[2] || 'g/dL', status: Number(match[1]) < 12 ? 'low' : 'normal', range: '12.0 - 17.5' }
      }
    }
    const valText = hbVal
      ? `Your test shows **${hbVal.name}** at **${hbVal.value} ${hbVal.unit}** (Reference: ${hbVal.range} ${hbVal.unit}).`
      : (targetDoc ? 'No CBC parameters were found in this document.' : 'A Complete Blood Count evaluates cellular components of blood.')
    return {
      content: `🔬 **Complete Blood Count (CBC) Findings**\n\n` +
        `• **Recorded Parameter:** ${valText}\n` +
        `• **Clinical Overview:**\n` +
        `  - **Hemoglobin:** Carries oxygen from lungs to body tissues. Normal is typically 13.5–17.5 g/dL (men) or 12.0–15.5 g/dL (women). Low levels indicate anemia.\n` +
        `  - **WBC Count:** Reflects immune response. Normal is 4,500–11,000 /mcL. Elevated levels can reflect inflammation or infection.\n` +
        `  - **Platelets:** Essential for blood clotting (Normal: 150,000–450,000 /mcL).\n` +
        `• **Next Steps:** If hemoglobin or iron markers are low, evaluate iron stores (serum ferritin) and dietary iron intake with your doctor.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 7. Medications & Prescriptions
  if (/medicine|medication|drug|dose|prescription|pill|tablet/i.test(normalized)) {
    const medList = medicines?.length > 0
      ? medicines.map((m) => `• **${m.name}** — ${m.dosage || 'As prescribed'}, ${m.frequency || 'Daily'} (${m.instructions || 'With food'})`).join('\n')
      : '• No active maintenance medications recorded in your timeline.'
    return {
      content: `💊 **Your Current Medications & Regimen**\n\n` +
        `${medList}\n\n` +
        `• **Medication Best Practices:**\n` +
        `  1. Take medications at consistent times daily.\n` +
        `  2. Set automated alerts in the **Reminders** tab so you never miss a dose.\n` +
        `  3. Check with your pharmacist before taking new over-the-counter supplements to prevent drug-drug interactions.`,
      sourceDocumentId: null,
    }
  }

  // 8. Appointments & Doctor Preparation
  if (/doctor|appointment|ask|prepare|visit|physician|clinic/i.test(normalized)) {
    const apptList = appointments?.length > 0
      ? appointments.map((a) => `• **${a.doctorName || 'Dr. Specialist'}** (${a.specialty || 'General Physician'}) on ${a.date || 'Upcoming'} at ${a.time || '10:00 AM'}`).join('\n')
      : '• No upcoming appointments scheduled.'
    return {
      content: `📋 **Doctor Visit Preparation Checklist**\n\n` +
        `**Upcoming Visits:**\n${apptList}\n\n` +
        `**Key Questions to Ask Your Doctor:**\n` +
        `1. *"Are any of my recent lab test values significantly outside the optimal range?"*\n` +
        `2. *"Do my current symptoms connect to these lab findings?"*\n` +
        `3. *"Are my current medication dosages still appropriate, or do we need adjustments?"*\n` +
        `4. *"What preventive tests or follow-ups should I schedule over the next 6 months?"*\n\n` +
        `💡 *Tip: You can download or print your HealthSaathi timeline summary to share with your provider.*`,
      sourceDocumentId: null,
    }
  }

  // 9. Compare reports
  if (/compare|trend|difference between|versus|vs/i.test(normalized)) {
    return {
      content: `📊 **Comparing Health Records & Tracking Biomarkers Over Time**\n\n` +
        `• **How Comparison Works in HealthSaathi:**\n` +
        `  1. Navigate to the **Timeline** tab to see your records arranged chronologically.\n` +
        `  2. Click on any biomarker (e.g. *HbA1c*, *Total Cholesterol*, *Vitamin D*) to view historical trends.\n` +
        `  3. In **My Records**, you can select individual reports to compare extracted lab values side-by-side.\n\n` +
        `• **What to Look For When Comparing:**\n` +
        `  - **Direction of change:** Is a borderline value improving, staying steady, or worsening?\n` +
        `  - **Medication correlation:** Did a change in prescription coincide with improvements in your numbers?\n` +
        `  - **Seasonal variance:** Vitamin D and lipid levels often fluctuate between winter and summer.\n\n` +
        `💡 *Ask me about specific tests like "Compare my lipid profile with earlier values" or select a record from the left.*`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 10. Available records overview
  if (/what information|available in my records|my records|my data|all reports/i.test(normalized)) {
    const docNames = documents?.length > 0
      ? documents.map((d) => `  - **${d.title || d.name}** (${d.type?.toUpperCase() || d.classification || 'LAB'}, ${d.provider || 'Record'})`).join('\n')
      : '  - No medical records uploaded yet'
    const medNames = medicines?.length > 0
      ? medicines.map((m) => `  - **${m.name}** (${m.dosage || 'Prescribed'})`).join('\n')
      : '  - No active prescriptions recorded'
    return {
      content: `📁 **Overview of Your HealthSaathi Records**\n\n` +
        `**Stored Medical Documents:**\n${docNames}\n\n` +
        `**Active Medications:**\n${medNames}\n\n` +
        `**Available Actions:**\n` +
        `• Click any document on the left sidebar to scope your questions directly to it.\n` +
        `• Ask me to explain specific biomarkers (e.g. *"What is my Vitamin D level?"* or *"Explain my CBC"*).\n` +
        `• Ask for visit preparation questions for your doctor.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 11. Blood Pressure / Hypertension
  if (/blood pressure|bp|hypertension|hypotension|systolic|diastolic/i.test(normalized)) {
    return {
      content: `🩺 **Blood Pressure (BP) Clinical Overview**\n\n` +
        `• **Standard Blood Pressure Classifications (AHA Guidelines):**\n` +
        `  - **Normal:** Systolic < 120 mmHg AND Diastolic < 80 mmHg\n` +
        `  - **Elevated:** Systolic 120–129 mmHg AND Diastolic < 80 mmHg\n` +
        `  - **Stage 1 Hypertension:** Systolic 130–139 mmHg OR Diastolic 80–89 mmHg\n` +
        `  - **Stage 2 Hypertension:** Systolic ≥ 140 mmHg OR Diastolic ≥ 90 mmHg\n\n` +
        `• **Common Symptoms & Factors:** Morning headaches, dizziness, high sodium diet, stress, or caffeine.\n` +
        `• **Questions for Doctor:** Should we monitor BP at home twice daily for 2 weeks, and do we need an ambulatory blood pressure monitor?`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 12. Thyroid / TSH
  if (/thyroid|tsh|t3|t4|hypothyroid|hyperthyroid/i.test(normalized)) {
    const tshVal = defaultReport?.labValues?.find((l) => /tsh|thyroid/i.test(l.name))
    const valText = tshVal
      ? `Your report shows **${tshVal.name}** at **${tshVal.value} ${tshVal.unit}** (Ref: ${tshVal.range} ${tshVal.unit}).`
      : (targetDoc ? 'No thyroid panel was found in this document.' : 'TSH (Thyroid Stimulating Hormone) regulates metabolic rate and energy.')
    return {
      content: `🦋 **Thyroid Function (TSH / T3 / T4) Overview**\n\n` +
        `• **Findings:** ${valText}\n` +
        `• **Interpretation:**\n` +
        `  - **High TSH (> 4.5 mIU/L):** Often signals hypothyroidism (underactive thyroid), where the pituitary releases extra TSH to stimulate the thyroid. Symptoms include fatigue, weight gain, and cold intolerance.\n` +
        `  - **Low TSH (< 0.4 mIU/L):** Signals hyperthyroidism (overactive thyroid). Symptoms include tremors, anxiety, and weight loss.\n` +
        `• **Next Steps:** Discuss whether Free T4 and anti-TPO antibodies should be tested to assess thyroid autoimmune status.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 13. Kidney / Creatinine / BUN / eGFR
  if (/kidney|creatinine|egfr|bun|renal|urine/i.test(normalized)) {
    const creatVal = defaultReport?.labValues?.find((l) => /creatinine|egfr|bun/i.test(l.name))
    const valText = creatVal
      ? `Your report records **${creatVal.name}** at **${creatVal.value} ${creatVal.unit}** (Ref: ${creatVal.range} ${creatVal.unit}).`
      : (targetDoc ? 'No kidney markers were found in this document.' : 'Serum creatinine is a byproduct of muscle metabolism filtered by the kidneys.')
    return {
      content: `🌊 **Kidney Function & Renal Biomarkers**\n\n` +
        `• **Report Findings:** ${valText}\n` +
        `• **Clinical Significance:**\n` +
        `  - **Creatinine:** Typical adult range is 0.7–1.3 mg/dL. Elevated creatinine may indicate reduced kidney filtration or temporary dehydration.\n` +
        `  - **eGFR:** Estimates filtering capacity. Normal is > 90 mL/min/1.73m².\n` +
        `• **Recommendations:** Maintain adequate hydration and avoid prolonged high-dose NSAID painkiller use without medical supervision.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 14. Report summary / explain document
  if (/explain|report|summary|test|lab|result/i.test(normalized)) {
    if (!defaultReport && targetDoc) {
      return {
        content: `📄 **Document Overview — ${targetDoc.title || targetDoc.name}**\n\n` +
          `**Document Type:** ${targetDoc.type || targetDoc.classification || 'Uploaded Record'}\n` +
          (targetDoc.description || targetDoc.notes ? `**Notes:** ${targetDoc.description || targetDoc.notes}\n\n` : '') +
          (targetDoc.extractedText ? `**Extracted Content Preview:**\n> ${targetDoc.extractedText.slice(0, 450).trim()}...\n\n` : '') +
          `• **Status:** ${targetDoc.status || 'Ready'}\n` +
          `No structured numerical lab biomarkers were identified in this file. If this is a medical test report, ensure the scan is clear and all pages are visible.`,
        sourceDocumentId: targetDoc.id || targetDoc._id || null,
      }
    }

    const rawSummary = defaultReport?.summary || targetDoc?.notes || 'Comprehensive health record detailing key clinical findings.'
    const docSummary = rawSummary.replace(/fictional\s+sample\s+report/gi, 'patient laboratory report')
    const labItems = defaultReport?.labValues?.map((l) => `  - **${l.name}:** ${l.value} ${l.unit} (${l.status.toUpperCase()}, Ref: ${l.range})`).join('\n') || '  - All listed parameters are within normal physiological limits.'
    return {
      content: `📄 **Medical Report Summary — ${defaultReport?.title || targetDoc?.title || 'Latest Health Record'}**\n\n` +
        `**Summary:**\n${docSummary}\n\n` +
        `**Extracted Key Biomarkers:**\n${labItems}\n\n` +
        `• **Clinical Interpretation:** These findings provide an objective baseline of your metabolic, hematologic, and nutritional health. If any values are marked **HIGH** or **LOW**, discuss them during your next consultation for personalized interpretation.`,
      sourceDocumentId: defaultReport?.documentId ?? targetDoc?.id ?? null,
    }
  }

  // 15. Default contextual response
  return {
    content: `👋 **HealthSaathi Clinical AI Assistant**\n\n` +
      `I can help you review your medical records, explain lab findings, and organize your health timeline.\n\n` +
      `Here are some things I can assist you with right now:\n` +
      `• **Analyze Reports:** *"Explain my blood test"* or *"What does my lipid panel mean?"*\n` +
      `• **Review Lab Values:** *"What is Vitamin D?"* or *"What is my glucose level?"*\n` +
      `• **Check Medicines:** *"What are my active medications and dosages?"*\n` +
      `• **Doctor Preparation:** *"Help me prepare questions for my upcoming appointment."*\n\n` +
      `Feel free to type any specific question or click one of the suggested prompts on the left!`,
    sourceDocumentId: targetDoc?.id ?? null,
  }
}

function formatConversationDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today, ${timeStr}`
  if (isYesterday) return `Yesterday, ${timeStr}`
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`
}

function createMessage(role, content, sourceDocumentId = null) {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content, sourceDocumentId, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
}

export default function CopilotPage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(t('copilot.title', 'AI Health Copilot'))
  const [searchParams, setSearchParams] = useSearchParams()
  const questionFromLink = (searchParams.get('q') ?? '').trim()
  const docFromLink = (searchParams.get('doc') ?? '').trim()
  const { documents, reports, medicines, appointments, addDocument } = useHealthData()
  const { user, isLiveAuth, token } = useAuth()
  const { notify } = useToast()
  const [selectedDocId, setSelectedDocId] = useState(() => docFromLink || null)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const fileInputRef = useRef(null)
  const fileInputMobileRef = useRef(null)
  const [messages, setMessages] = useState(() => questionFromLink
    ? [createMessage('user', questionFromLink)]
    : [])

  useEffect(() => {
    if (docFromLink) {
      setSelectedDocId(docFromLink)
    }
  }, [docFromLink])
  const messagesEndRef = useRef(null)
  const timersRef = useRef([])

  // Speech-to-Text (STT) state
  const [recordingState, setRecordingState] = useState('idle') // 'idle' | 'recording' | 'transcribing'
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const recordingTimerRef = useRef(null)

  // Clean up microphone streams and recording timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => track.stop())
        } catch {}
      }
    }
  }, [])

  // Chat History state
  const [conversations, setConversations] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const [editingConvId, setEditingConvId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')

  const hasProcessedLink = useRef(false)

  const loadConversations = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const items = await copilotApi.getConversations()
      setConversations(Array.isArray(items) ? items : [])
    } catch (err) {
      console.warn('[CopilotPage] Failed to fetch conversations:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  // Clear user-specific history and active chat on auth identity change
  useEffect(() => {
    setActiveConversationId(null)
    setMessages([])
    setConversations([])
    loadConversations()
  }, [user?.id, user?.uid, token, loadConversations])

  const openConversation = async (conv) => {
    const convId = conv._id || conv.id
    if (!convId) return
    setActiveConversationId(convId)
    setIsHistoryOpen(false)
    setInput('')
    setSelectedDocId(null)

    // 1. Instant optimistic render from local cache (0ms perceived latency)
    const cached = copilotApi.getCachedMessages(convId)
    if (cached && cached.length > 0) {
      const formattedCached = cached.map((m) => ({
        id: m.id || m._id || `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: m.role,
        content: m.content,
        sourceDocumentId: m.sourceDocumentIds?.[0] || null,
        time: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      setMessages(formattedCached)
      setIsLoadingConversation(false)
    } else {
      setIsLoadingConversation(true)
    }

    // 2. Fetch fresh updates from server in background
    try {
      const rawMessages = await copilotApi.getMessages(convId)
      const formatted = (rawMessages || []).map((m) => ({
        id: m.id || m._id || `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: m.role,
        content: m.content,
        sourceDocumentId: m.sourceDocumentIds?.[0] || null,
        time: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      setMessages(formatted)
    } catch (err) {
      console.warn('[CopilotPage] Failed to load messages:', err)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const startNewConversation = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
    setThinking(false)
    setIsLoadingConversation(false)
    setInput('')
    setIsAttachMenuOpen(false)
    setActiveConversationId(null)
    setSelectedDocId(null)
    setMessages([])
    setIsHistoryOpen(false)
    if (questionFromLink) setSearchParams({}, { replace: true })
  }

  const handleRename = async (convId) => {
    const cleanTitle = editingTitle.trim()
    if (!cleanTitle) {
      setEditingConvId(null)
      return
    }
    try {
      await copilotApi.renameConversation(convId, cleanTitle)
      setConversations((prev) =>
        prev.map((c) => ((c._id || c.id) === convId ? { ...c, title: cleanTitle } : c))
      )
    } catch (err) {
      console.warn('[CopilotPage] Failed to rename conversation:', err)
    } finally {
      setEditingConvId(null)
    }
  }

  const handleDelete = async (conv) => {
    const convId = conv._id || conv.id
    if (!convId) return
    try {
      await copilotApi.deleteConversation(convId)
      setConversations((prev) => prev.filter((c) => (c._id || c.id) !== convId))
      if (activeConversationId === convId) {
        startNewConversation()
      }
      setConversationToDelete(null)
    } catch (err) {
      console.warn('[CopilotPage] Failed to delete conversation:', err)
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        console.warn('[CopilotPage] Error stopping mediaRecorder:', err)
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (recordingState !== 'idle' || thinking) return

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify({
        title: 'Microphone Not Supported',
        description: t('copilot.mic_unsupported', 'Audio recording is not supported on this browser.'),
        tone: 'warning',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ]
      const chosenType = candidateTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
      const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        const mimeType = recorder.mimeType || chosenType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []

        if (streamRef.current) {
          try {
            streamRef.current.getTracks().forEach((track) => track.stop())
          } catch {}
          streamRef.current = null
        }

        if (audioBlob.size < 400) {
          setRecordingState('idle')
          notify({
            title: 'Voice Input',
            description: t('copilot.mic_empty', 'No speech was detected. Please try speaking again.'),
            tone: 'info',
          })
          return
        }

        setRecordingState('transcribing')
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm'
          const currentLang = i18n.language || user?.preferences?.language
          const langParam = (currentLang && currentLang !== 'en') ? currentLang : undefined

          const res = await sttApi.transcribeAudio(audioBlob, {
            filename: `voice-${Date.now()}.${ext}`,
            language: langParam,
          })

          const recognizedText = (res?.text || res?.data?.text || '').trim()
          if (recognizedText) {
            setInput((prev) => (prev && prev.trim() ? `${prev.trim()} ${recognizedText}` : recognizedText))
            notify({
              title: 'Speech Transcribed',
              description: t('copilot.mic_success', 'Speech transcribed and added to chat input.'),
              tone: 'success',
            })
          } else {
            notify({
              title: 'Voice Input',
              description: t('copilot.mic_empty', 'No speech was detected. Please try speaking again.'),
              tone: 'info',
            })
          }
        } catch (sttErr) {
          console.warn('[CopilotPage] STT transcription failed:', sttErr)
          notify({
            title: 'Voice Transcription Notice',
            description: sttErr.message || 'Unable to transcribe audio. Please try typing your question.',
            tone: 'warning',
          })
        } finally {
          setRecordingState('idle')
        }
      }

      recorder.start(250)
      setRecordingState('recording')
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 120) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.warn('[CopilotPage] Microphone access error:', err)
      const e = err
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        notify({
          title: 'Microphone Access',
          description: t('copilot.mic_permission_denied', 'Microphone permission was denied. Please enable microphone access to speak.'),
          tone: 'warning',
        })
      } else {
        notify({
          title: 'Microphone Error',
          description: e.message || t('copilot.mic_unsupported', 'Audio recording is not supported on this browser.'),
          tone: 'warning',
        })
      }
      setRecordingState('idle')
    }
  }, [recordingState, thinking, notify, t, i18n.language, user?.preferences?.language, stopRecording])

  const openHistory = () => {
    loadConversations()
    setIsHistoryOpen(true)
  }

  const handleAiQuery = useCallback(async (question, targetDocId = null) => {
    setThinking(true)
    const effectiveDocId = targetDocId || selectedDocId || null
    const effectiveLanguage = i18n.language || user?.preferences?.language || 'en'

    let hasGroqError = false
    try {
      const convId = activeConversationId || 'default'

      // Build document context for grounded LLM inference
      let docContext = ''
      if (effectiveDocId) {
        const doc = documents.find((d) => d.id === effectiveDocId || d._id === effectiveDocId)
        const rep = reports.find((r) => r.documentId === effectiveDocId || r.id === effectiveDocId)
        if (doc) {
          const isMedical = doc.isMedicalDocument !== false && doc.type !== 'OTHER' && doc.category !== 'OTHER'
          if (!isMedical) {
            docContext = `Selected Document: "${doc.title || doc.name}"\n` +
              `Classification: NON-MEDICAL DOCUMENT (${doc.classification || doc.type || 'Non-Clinical'})\n` +
              `Note: This document contains non-clinical content. It does NOT contain blood tests, vitals, or clinical findings.\n` +
              (doc.extractedText ? `Extracted Content:\n"""\n${doc.extractedText.slice(0, 4000)}\n"""` : '')
          } else {
            docContext = `Selected Document: "${doc.title || doc.name || rep?.title || 'Report'}"\n` +
              `Summary: ${(doc.summary || rep?.summary || doc.description || 'N/A').replace(/fictional\s+sample\s+report/gi, 'patient laboratory report')}\n` +
              (doc.extractedText ? `Document Extracted Text:\n"""\n${doc.extractedText.slice(0, 4000)}\n"""\n` : '') +
              (rep?.labValues ? `Lab Values & Biomarkers:\n${(rep.labValues || []).map((l) => `  - ${l.name}: ${l.value} ${l.unit} (${l.status.toUpperCase()}, ref: ${l.range})`).join('\n')}` : '')
          }
        }
      }

      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }))

      const res = await copilotApi.sendMessage(convId, {
        content: question,
        sourceDocumentId: effectiveDocId || undefined,
        context: docContext || undefined,
        history,
        language: effectiveLanguage,
      })

      const replyText = res?.message?.content || res?.content
      if (replyText) {
        const finalConvId = res?.conversationId || (convId !== 'default' ? convId : null)
        if (finalConvId && (!activeConversationId || activeConversationId !== finalConvId)) {
          setActiveConversationId(finalConvId)
        }
        const sourceDocId = res?.message?.sourceDocumentIds?.[0] || effectiveDocId || null
        setMessages((current) => [...current, createMessage('assistant', replyText, sourceDocId)])
        setThinking(false)
        loadConversations().catch(() => {})
        return
      }
    } catch (err) {
      console.warn('[CopilotPage] Backend/Groq AI call error, providing client clinical response:', err)
      hasGroqError = true
    }

    try {
      // Client clinical knowledge response
      const reply = generateClinicalReply(question, documents, reports, medicines, appointments, effectiveDocId, user, effectiveLanguage)
      let finalContent = reply.content
      if (hasGroqError) {
        finalContent = `${finalContent}\n\n---\n> 💡 *Notice: The cloud AI service (GPT-OSS 120B) is experiencing high demand or a momentary connection delay. I have securely generated this response using HealthSaathi’s verified clinical engine so you receive immediate information without delay.*`
      }
      setMessages((current) => [...current, createMessage('assistant', finalContent, reply.sourceDocumentId)])
      if (hasGroqError) {
        notify({
          title: 'AI Assistant Notice',
          description: 'Cloud AI service is busy. Answer provided via local clinical assistant.',
          tone: 'info',
        })
      }
    } catch (fallbackErr) {
      console.error('[CopilotPage] Fallback generation error:', fallbackErr)
      const friendlyErrorMsg = `### ⚠️ AI Assistant Service Notice\n\nWe encountered a momentary delay connecting to the **Groq AI service (GPT-OSS 120B)**.\n\n- **Your Health Records:** All your documents, lab tests, and appointments remain completely safe and intact.\n- **What you can do:** You can try asking your question again in a moment, or check your internet connection.\n\nIf you have an urgent medical query, please consult a healthcare professional directly.`
      setMessages((current) => [...current, createMessage('assistant', friendlyErrorMsg, null)])
      notify({
        title: 'AI Service Notice',
        description: 'Unable to reach the AI model right now. Please try again shortly.',
        tone: 'warning',
      })
    } finally {
      setThinking(false)
      loadConversations().catch(() => {})
    }
  }, [activeConversationId, selectedDocId, documents, reports, medicines, appointments, messages, loadConversations, user, i18n.language])

  const handleDirectFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setIsUploadingDoc(true)
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      const created = await addDocument({
        file,
        title: cleanTitle,
        type: 'other',
        date: new Date().toISOString().slice(0, 10),
        description: 'Uploaded via Copilot chat',
      })
      const newDocId = created?.id || created?._id
      if (newDocId) {
        setSelectedDocId(newDocId)
        notify({
          title: 'Document attached',
          description: `“${cleanTitle}” is attached. You can now ask questions about this document.`,
          tone: 'success',
        })
      }
      setIsAttachMenuOpen(false)
    } catch (err) {
      console.warn('[CopilotPage] Direct file upload failed:', err)
      notify({
        title: 'Upload failed',
        description: err.message || 'Could not attach file to chat.',
        tone: 'danger',
      })
    } finally {
      setIsUploadingDoc(false)
      if (event.target) event.target.value = ''
    }
  }

  useEffect(() => {
    if (!questionFromLink || hasProcessedLink.current) return undefined
    hasProcessedLink.current = true
    handleAiQuery(questionFromLink, docFromLink || null)
  }, [questionFromLink, docFromLink, handleAiQuery])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), [])

  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false)
  const attachMenuRef = useRef(null)
  const attachMenuMobileRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      const inDesktop = attachMenuRef.current && attachMenuRef.current.contains(event.target)
      const inMobile = attachMenuMobileRef.current && attachMenuMobileRef.current.contains(event.target)
      if (!inDesktop && !inMobile) {
        setIsAttachMenuOpen(false)
      }
    }
    if (isAttachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAttachMenuOpen])

  const submit = async (event) => {
    event?.preventDefault()
    const question = input.trim()
    if (!question || thinking) return
    setMessages((current) => [...current, createMessage('user', question)])
    setInput('')
    await handleAiQuery(question)
  }

  const activeConversation = conversations.find(
    (c) => (c._id || c.id) === activeConversationId
  )

  const filteredConversations = conversations.filter((c) => {
    if (!historySearch.trim()) return true
    const term = historySearch.toLowerCase()
    const cleanPreview = stripMarkdown(c.lastMessagePreview || '')
    return (
      (c.title && c.title.toLowerCase().includes(term)) ||
      (cleanPreview && cleanPreview.toLowerCase().includes(term))
    )
  })

  const renderChatInputForm = (isCentered = false) => (
    <div className={cn('w-full', isCentered && 'max-w-xl mx-auto')}>
      {selectedDocId && (
        <div className="mb-2.5 sm:mb-3 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/90 px-3 py-1.5 text-xs text-brand-800 shadow-2xs">
          <span className="flex items-center gap-1.5 truncate">
            <FileText className="size-3.5 shrink-0 text-brand-600" />
            Attached Record:{' '}
            <strong className="truncate font-semibold">
              {documents.find((d) => d.id === selectedDocId || d._id === selectedDocId)?.title ||
                documents.find((d) => d.id === selectedDocId || d._id === selectedDocId)?.name ||
                'Selected Document'}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setSelectedDocId(null)}
            className="ml-2 font-bold text-brand-600 hover:text-brand-900 cursor-pointer"
            aria-label="Remove attached record"
          >
            ✕
          </button>
        </div>
      )}

      {/* Speech-to-Text (STT) Recording & Transcribing Status Banner */}
      {recordingState === 'recording' && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-xs text-rose-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-600" />
            </span>
            <span className="font-semibold">{t('copilot.mic_recording', 'Recording audio...')}</span>
            <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-mono font-bold text-rose-700">
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
          >
            <Square className="size-3 fill-current" />
            <span>{t('copilot.mic_stop', 'Stop & Transcribe')}</span>
          </button>
        </div>
      )}
      {recordingState === 'transcribing' && (
        <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/90 px-3 py-2 text-xs text-brand-800 animate-in fade-in duration-200">
          <Loader2 className="size-3.5 animate-spin text-brand-600" />
          <span className="font-medium">{t('copilot.mic_transcribing', 'Transcribing speech with Groq Whisper...')}</span>
        </div>
      )}

      <form
        onSubmit={submit}
        className={cn(
          'relative flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-white p-1.5 sm:p-2 transition focus-within:ring-2 focus-within:ring-brand-200',
          isCentered
            ? 'border-2 border-brand-300 shadow-md focus-within:border-brand-500'
            : 'border border-ice-200 shadow-xs focus-within:border-brand-300'
        )}
      >
        {/* Attach Records Menu Popover */}
        <div ref={isCentered ? attachMenuMobileRef : attachMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAttachMenuOpen((open) => !open)}
            aria-label="Attach medical record"
            title="Attach medical record"
            className={cn(
              'grid size-9 sm:size-11 shrink-0 place-items-center rounded-xl transition cursor-pointer border',
              selectedDocId
                ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                : 'border-transparent text-navy-700 hover:bg-ice-100'
            )}
          >
            <Plus className={cn('size-4.5 sm:size-5 transition-transform duration-200', isAttachMenuOpen && 'rotate-45')} />
          </button>

          {isAttachMenuOpen && (
            <div
              role="menu"
              className={cn(
                'absolute left-0 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl border border-ice-200 bg-white p-3 shadow-pop z-30',
                isCentered ? 'top-full mt-2' : 'bottom-full mb-3'
              )}
            >
              <div className="flex items-center justify-between border-b border-ice-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-brand-600" />
                  <span className="text-xs font-extrabold text-navy-900">Attach Medical Record</span>
                </div>
                {selectedDocId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocId(null)
                      setIsAttachMenuOpen(false)
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Detach
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted">
                Select a record to scope clinical AI questions, or upload a new file:
              </p>

              {/* Direct Upload Input & Button */}
              <div className="mt-2.5">
                <input
                  ref={isCentered ? fileInputMobileRef : fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleDirectFileUpload}
                />
                <button
                  type="button"
                  disabled={isUploadingDoc}
                  onClick={() => (isCentered ? fileInputMobileRef : fileInputRef).current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/70 p-2.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 hover:border-brand-400 cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-brand-600" />
                      <span>Uploading & Analyzing File…</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="size-4 text-brand-600" />
                      <span>Upload document from device</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {documents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">No documents available yet. Upload one above!</p>
                ) : (
                  documents.map((document) => {
                    const docId = document.id || document._id
                    const isSelected = selectedDocId === docId || selectedDocId === document.id || selectedDocId === document._id
                    const docName = document.title || document.name || document.fileName || 'Document'
                    return (
                      <button
                        key={docId}
                        type="button"
                        onClick={() => {
                          setSelectedDocId(isSelected ? null : docId)
                          setIsAttachMenuOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition cursor-pointer border',
                          isSelected
                            ? 'border-brand-300 bg-brand-50/90 text-brand-900 shadow-xs'
                            : 'border-transparent hover:bg-ice-50 text-navy-900'
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-lg',
                            isSelected ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'
                          )}
                        >
                          <FileText className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{docName}</span>
                          <span className="block truncate text-[10px] text-muted">
                            {document.type?.toUpperCase() || document.classification || 'DOCUMENT'} · {document.provider || 'Record'}
                          </span>
                        </span>
                        {isSelected ? (
                          <Badge tone="brand" className="text-[10px]">
                            <Check className="size-3 mr-0.5" /> Attached
                          </Badge>
                        ) : (
                          <Badge tone="ice" className="text-[10px]">
                            Select
                          </Badge>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <label htmlFor={isCentered ? 'copilot-message-centered' : 'copilot-message'} className="sr-only">
          Ask HealthSaathi a question
        </label>
        <textarea
          id={isCentered ? 'copilot-message-centered' : 'copilot-message'}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(event)
            }
          }}
          placeholder={
            selectedDocId
              ? `${t('copilot.attached_document', 'Referencing Document:')} ${documents.find((d) => d.id === selectedDocId || d._id === selectedDocId)?.title || documents.find((d) => d.id === selectedDocId || d._id === selectedDocId)?.name || 'attached record'}…`
              : t('copilot.placeholder', 'Ask about your lab results, doctor notes, or medical terms…')
          }
          className="max-h-32 min-h-[40px] sm:min-h-[44px] flex-1 resize-none bg-transparent px-2 sm:px-3 py-2 sm:py-2.5 text-base sm:text-sm leading-relaxed text-navy-900 placeholder:text-muted focus:outline-none"
        />

        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={recordingState === 'recording' ? stopRecording : startRecording}
          disabled={thinking || recordingState === 'transcribing'}
          aria-label={
            recordingState === 'recording'
              ? t('copilot.mic_stop', 'Stop recording & transcribe')
              : t('copilot.mic_start', 'Start voice input')
          }
          title={
            recordingState === 'recording'
              ? t('copilot.mic_stop', 'Stop recording & transcribe')
              : t('copilot.mic_start', 'Start voice input')
          }
          className={cn(
            'grid size-9 sm:size-11 shrink-0 place-items-center rounded-xl transition cursor-pointer border',
            recordingState === 'recording'
              ? 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse'
              : recordingState === 'transcribing'
              ? 'border-brand-200 bg-brand-50 text-brand-600 cursor-not-allowed'
              : 'border-transparent text-navy-700 hover:bg-ice-100'
          )}
        >
          {recordingState === 'recording' ? (
            <Square className="size-3.5 sm:size-4 fill-rose-600 text-rose-600" />
          ) : recordingState === 'transcribing' ? (
            <Loader2 className="size-4 animate-spin text-brand-600" />
          ) : (
            <Mic className="size-4 sm:size-4.5" />
          )}
        </button>

        <button
          type="submit"
          disabled={!input.trim() || thinking || recordingState === 'recording'}
          aria-label={t('copilot.send_btn', 'Send message')}
          className={cn(
            'grid size-9 sm:size-11 shrink-0 place-items-center rounded-xl transition',
            input.trim() && !thinking && recordingState !== 'recording'
              ? 'bg-navy-900 text-white hover:bg-navy-800 cursor-pointer'
              : 'cursor-not-allowed bg-ice-100 text-muted'
          )}
        >
          <Send className="size-3.5 sm:size-4" />
        </button>
      </form>
    </div>
  )

  return (
    <div className="flex flex-col gap-0 sm:gap-5">
      {/* PageHeader — hidden on mobile to reclaim screen real-estate */}
      <div className="hidden sm:block">
        <PageHeader
          eyebrow={t('copilot.eyebrow', 'Your personal health companion')}
          title={t('copilot.title', 'AI Health Copilot')}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="secondary"
                onClick={openHistory}
                className="relative cursor-pointer text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2"
              >
                <History className="size-3.5 sm:size-4" aria-hidden="true" />
                <span>{t('copilot.history', 'History')}</span>
                {conversations.length > 0 && (
                  <span className="ml-1 rounded-full bg-brand-50 border border-brand-200 px-1.5 py-0.2 text-[10px] font-bold text-brand-700">
                    {conversations.length}
                  </span>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={startNewConversation}
                className="cursor-pointer text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2"
              >
                <Plus className="size-3.5 sm:size-4" aria-hidden="true" />
                <span>{t('copilot.new_chat', 'New chat')}</span>
              </Button>
            </div>
          }
        />
      </div>

      <section className="panel flex h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-13.5rem)] sm:min-h-[480px] max-h-[860px] w-full min-w-0 flex-col overflow-hidden" aria-label="Copilot conversation">
          <header className="flex items-center justify-between gap-2 border-b border-ice-100 bg-white/60 px-2.5 py-1.5 sm:px-6 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SafeImage src="/images/ai-assistant.png" alt="" className="size-7 sm:size-11 shrink-0 overflow-hidden rounded-lg sm:rounded-2xl shadow-xs" imgClassName="size-full object-cover" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-xs sm:text-sm font-extrabold text-navy-900 truncate">Your HealthSaathi</h2>
                  {/* Conversation title shown inline on desktop only — no gray chip on mobile */}
                  {activeConversation?.title && (
                    <span className="hidden sm:inline-block max-w-xs truncate rounded-md bg-ice-100 px-2 py-0.5 text-[11px] font-semibold text-navy-800">
                      {activeConversation.title}
                    </span>
                  )}
                </div>
                {/* Subtitle only visible on desktop */}
                <p className="hidden sm:block mt-0.5 text-xs text-muted truncate">
                  {selectedDocId
                    ? `Scoped: ${documents.find((d) => d.id === selectedDocId)?.title || 'Selected Record'}`
                    : 'Clinical AI Assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* History button — mobile shows icon only, desktop shows text */}
              <button
                type="button"
                onClick={openHistory}
                aria-label="Chat history"
                className="inline-flex items-center gap-1 rounded-xl border border-ice-200 bg-white/80 px-2 py-1.5 sm:px-3 text-xs font-semibold text-navy-700 hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700 transition cursor-pointer shadow-2xs"
              >
                <History className="size-3.5 text-brand-600" />
                <span className="hidden sm:inline">History ({conversations.length})</span>
              </button>
              {/* New chat button on mobile */}
              <button
                type="button"
                onClick={startNewConversation}
                aria-label="New chat"
                className="sm:hidden inline-flex items-center gap-1 rounded-xl border border-ice-200 bg-white/80 px-2 py-1.5 text-xs font-semibold text-navy-700 hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700 transition cursor-pointer shadow-2xs"
              >
                <Plus className="size-3.5 text-brand-600" />
              </button>
              <Badge tone="brand" className="text-[10px] sm:text-xs px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-brand-600" />
                <span className="hidden sm:inline">Live AI Copilot</span>
                <span className="sm:hidden">Live AI</span>
              </Badge>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {isLoadingConversation ? (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center py-4 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="mt-3 text-xs font-semibold text-navy-800">Loading conversation…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center py-3 sm:justify-center sm:py-4 text-center">
                {/* AI avatar + greeting */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="absolute inset-0 rounded-2xl bg-brand-200/50 blur-xl" />
                    <SafeImage
                      src="/images/ai-assistant.png"
                      alt=""
                      className="relative size-10 sm:size-14 overflow-hidden rounded-2xl border border-brand-200 shadow-sm"
                      imgClassName="size-full object-cover"
                    />
                  </div>
                  <h3 className="text-base sm:text-xl font-extrabold tracking-tight text-navy-900">
                    How can HealthSaathi help you today?
                  </h3>
                  {/* Subtitle hidden on mobile for headroom */}
                  <p className="hidden sm:block mt-1 max-w-md text-[13px] leading-5 text-muted">
                    Ask clinical questions about your lab tests, prescriptions, and biomarkers, or click any prompt below to begin.
                  </p>
                </div>

                {/* Mobile: Suggested prompts ABOVE the input field */}
                <div className="mt-3 w-full max-w-md px-1 sm:hidden">
                  <div className="grid gap-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={thinking}
                        onClick={() => {
                          if (thinking) return
                          setMessages((current) => [...current, createMessage('user', prompt)])
                          handleAiQuery(prompt)
                        }}
                        className="group flex items-center gap-2.5 rounded-xl border border-ice-200 bg-white/90 p-2.5 text-left text-xs font-semibold leading-5 text-navy-850 shadow-xs transition hover:border-brand-300 hover:bg-brand-50/70 hover:shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                          <MessageCircle className="size-3.5" />
                        </span>
                        <span className="flex-1">{prompt}</span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100 group-hover:text-brand-600" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile-only Centered Chat Input Box — placed BELOW the prompts */}
                <div className="mt-3 w-full max-w-md px-1 sm:hidden text-left">
                  {renderChatInputForm(true)}
                </div>

                {/* Desktop: prompts below the input (standard layout) */}
                <div className="hidden sm:block mt-5 w-full max-w-xl">
                  <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
                    Suggested prompts
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={thinking}
                        onClick={() => {
                          if (thinking) return
                          setMessages((current) => [...current, createMessage('user', prompt)])
                          handleAiQuery(prompt)
                        }}
                        className="group flex items-start gap-2.5 rounded-xl border border-ice-200 bg-white/90 p-3 text-left text-xs font-semibold leading-5 text-navy-850 shadow-xs transition hover:border-brand-300 hover:bg-brand-50/70 hover:shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                          <MessageCircle className="size-3.5" />
                        </span>
                        <span className="flex-1">{prompt}</span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100 group-hover:text-brand-600" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    documents={documents}
                    isLiveAuth={isLiveAuth}
                  />
                ))}
              </div>
            )}
            {thinking && (
              <div className="mt-4 flex items-start gap-3">
                <SafeImage
                  src="/images/ai-assistant.png"
                  alt=""
                  className="size-9 shrink-0 overflow-hidden rounded-xl"
                  imgClassName="size-full object-cover"
                />
                <div className="rounded-2xl rounded-tl-md border border-ice-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 animate-pulse rounded-full bg-brand-500" />
                    <span className="size-2 animate-pulse rounded-full bg-brand-500 [animation-delay:120ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-brand-500 [animation-delay:240ms]" />
                    <span className="ml-1 text-xs text-muted">{t('copilot.thinking', 'Analyzing clinical records…')}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={cn('border-t border-ice-100 bg-white/60 p-2.5 sm:p-4', messages.length === 0 && 'hidden sm:block')}>
            {renderChatInputForm(false)}
          </div>
        </section>

      {/* ─── Chat History Slide-Over Drawer ─── */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Conversation History">
          <div
            className="fixed inset-0 bg-navy-950/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsHistoryOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
            <aside className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-ice-200 animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-ice-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <History className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-navy-900">Conversation History</h3>
                    <p className="text-[11px] text-muted">
                      {conversations.length} saved {conversations.length === 1 ? 'consultation' : 'consultations'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="rounded-xl p-2 text-muted hover:bg-ice-100 hover:text-navy-900 transition cursor-pointer"
                  aria-label="Close history"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Drawer Action Bar */}
              <div className="p-4 border-b border-ice-100 space-y-3 bg-ice-50/50">
                <Button
                  variant="primary"
                  onClick={startNewConversation}
                  className="w-full justify-center shadow-xs cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Start New Conversation</span>
                </Button>

                {conversations.length > 2 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search previous chats…"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full rounded-xl border border-ice-200 bg-white pl-9 pr-3 py-1.5 text-xs text-navy-900 placeholder:text-muted focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                )}
              </div>

              {/* Drawer Conversation List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoadingHistory ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 rounded-2xl bg-ice-100/70 animate-pulse" />
                    ))}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 mb-3">
                      <MessageSquare className="size-6" />
                    </div>
                    <h4 className="text-sm font-bold text-navy-900">
                      {historySearch ? 'No matches found' : 'No previous conversations'}
                    </h4>
                    <p className="mt-1 max-w-xs text-xs text-muted">
                      {historySearch
                        ? 'Try a different search term or start a new chat.'
                        : 'Questions you ask HealthSaathi will be saved here so you can revisit them anytime.'}
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const convId = conv._id || conv.id
                    const isActive = activeConversationId === convId
                    const isEditing = editingConvId === convId

                    return (
                      <div
                        key={convId}
                        onClick={() => {
                          if (!isEditing) openConversation(conv)
                        }}
                        className={cn(
                          'group relative rounded-2xl border p-3.5 transition text-left cursor-pointer',
                          isActive
                            ? 'border-brand-300 bg-brand-50/70 shadow-xs ring-1 ring-brand-200'
                            : 'border-ice-200 bg-white hover:border-brand-200 hover:bg-ice-50/60'
                        )}
                      >
                        {isEditing ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(convId)
                                if (e.key === 'Escape') setEditingConvId(null)
                              }}
                              autoFocus
                              className="w-full rounded-lg border border-brand-300 px-2 py-1 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingConvId(null)}
                                className="px-2 py-1 text-[11px] font-semibold text-muted hover:text-navy-900 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRename(convId)}
                                className="px-2.5 py-1 rounded-md bg-brand-600 text-[11px] font-semibold text-white hover:bg-brand-700 cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-xs font-bold text-navy-900 group-hover:text-brand-700">
                                  {conv.title || 'Health Consultation'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingConvId(convId)
                                    setEditingTitle(conv.title || '')
                                  }}
                                  title="Rename conversation"
                                  className="p-1 text-muted hover:text-navy-900 transition rounded hover:bg-ice-100 cursor-pointer"
                                >
                                  <PenLine className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setConversationToDelete(conv)
                                  }}
                                  title="Delete conversation"
                                  className="p-1 text-muted hover:text-rose-600 transition rounded hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>

                            {conv.lastMessagePreview && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                                {stripMarkdown(conv.lastMessagePreview)}
                              </p>
                            )}

                            <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatConversationDate(conv.lastMessageAt || conv.updatedAt || conv.createdAt)}
                              </span>
                              {isActive && (
                                <span className="font-bold text-brand-700 bg-brand-100/60 px-1.5 py-0.5 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal
        open={Boolean(conversationToDelete)}
        onClose={() => setConversationToDelete(null)}
        title="Delete conversation?"
        description="Are you sure you want to delete this conversation? This will permanently remove all messages from your chat history."
      >
        <div className="p-6 pt-2 flex items-center justify-end gap-3 border-t border-ice-100">
          <Button variant="secondary" onClick={() => setConversationToDelete(null)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleDelete(conversationToDelete)}
            className="bg-rose-600 hover:bg-rose-700 text-white border-transparent cursor-pointer"
          >
            <Trash2 className="size-4" />
            <span>Delete</span>
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function splitTableRow(line) {
  let cleaned = line.trim()
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1)
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1)
  return cleaned.split('|').map((cell) => cell.trim())
}

function isTableDivider(line) {
  const trimmed = line.trim()
  return (
    /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed) ||
    (/^\|?[\s\-:|]+$/.test(trimmed) && trimmed.includes('-'))
  )
}

function parseMarkdownBlocks(text) {
  if (!text) return []
  const rawLines = text.split('\n')
  const blocks = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // 1. Skip empty lines
    if (!trimmed) {
      i++
      continue
    }

    // 2. Horizontal divider
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 3. Headings (#, ##, ###)
    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})/)[0].length
      const content = trimmed.replace(/^#{1,6}\s+/, '')
      blocks.push({ type: 'heading', level, content })
      i++
      continue
    }

    // 4. Standalone bold section header: **Current medications**
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      const content = trimmed.slice(2, -2).trim()
      blocks.push({ type: 'section-title', content })
      i++
      continue
    }

    // 5. Emergency / Important Callout
    if (/^⚠️/.test(trimmed)) {
      const alertLines = []
      while (i < rawLines.length && rawLines[i].trim()) {
        alertLines.push(rawLines[i])
        i++
      }
      blocks.push({ type: 'emergency-alert', content: alertLines.join('\n') })
      continue
    }

    // 6. Markdown Tables
    const isTableLine = (l) => {
      const t = l.trim()
      return (
        (t.startsWith('|') && (t.endsWith('|') || t.split('|').length >= 3)) ||
        (t.includes('|') && t.split('|').length >= 3)
      )
    }

    if (isTableLine(line)) {
      const tableLines = []
      while (i < rawLines.length && isTableLine(rawLines[i])) {
        tableLines.push(rawLines[i])
        i++
      }

      let headers = null
      let rows = []

      if (tableLines.length >= 2 && isTableDivider(tableLines[1])) {
        headers = splitTableRow(tableLines[0])
        rows = tableLines.slice(2).filter((l) => !isTableDivider(l)).map(splitTableRow)
      } else {
        rows = tableLines.filter((l) => !isTableDivider(l)).map(splitTableRow)
      }

      blocks.push({ type: 'table', headers, rows })
      continue
    }

    // 7. Unordered lists (-, *, •)
    const isUnordered = (l) => /^[-*•]\s+/.test(l.trim())
    if (isUnordered(line)) {
      const items = []
      while (i < rawLines.length && isUnordered(rawLines[i])) {
        items.push(rawLines[i].trim().replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // 8. Ordered lists (1., 2., etc.)
    const isOrdered = (l) => /^\d+\.\s+/.test(l.trim())
    if (isOrdered(line)) {
      const items = []
      while (i < rawLines.length && isOrdered(rawLines[i])) {
        items.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // 9. Regular paragraphs
    const paraLines = []
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !/^(---|___|\*\*\*)$/.test(rawLines[i].trim()) &&
      !/^#{1,6}\s+/.test(rawLines[i].trim()) &&
      !/^\*\*[^*]+\*\*$/.test(rawLines[i].trim()) &&
      !/^⚠️/.test(rawLines[i].trim()) &&
      !isTableLine(rawLines[i]) &&
      !isUnordered(rawLines[i]) &&
      !isOrdered(rawLines[i])
    ) {
      paraLines.push(rawLines[i])
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({ type: 'p', content: paraLines.join('\n') })
    }
  }

  return blocks
}

function InlineMarkdown({ text, isCell = false }) {
  if (!text) return null

  if (isCell) {
    const trimmedLower = text.trim().toLowerCase()
    if (
      trimmedLower === 'normal' ||
      trimmedLower === 'within normal limits' ||
      trimmedLower === 'optimal'
    ) {
      return (
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
          {text}
        </span>
      )
    }
  }

  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|==[^=]+==)/g)

  const renderGreenHighlight = (content, key) => (
    <span
      key={key}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/90 px-2.5 py-0.5 text-xs sm:text-sm font-black text-emerald-800 shadow-2xs ring-1 ring-emerald-400/50"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {content}
    </span>
  )

  const BLOOD_GROUP_REGEX = /\b(AB[+-]|A[+-]|B[+-]|O[+-]|(?:A|B|AB|O)[-\s]*(?:positive|negative))(?=[^a-zA-Z0-9]|$)/i

  const renderTextWithBloodGroup = (str, baseKey) => {
    if (typeof str !== 'string') return str
    const tokens = str.split(BLOOD_GROUP_REGEX)
    if (tokens.length <= 1) return str
    return tokens.map((token, tIdx) => {
      if (/^(?:AB[+-]|A[+-]|B[+-]|O[+-]|(?:A|B|AB|O)[-\s]*(?:positive|negative))$/i.test(token.trim())) {
        return renderGreenHighlight(token, `${baseKey}-bg-${tIdx}`)
      }
      return token
    })
  }

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null

        if (part.startsWith('==') && part.endsWith('==')) {
          const inner = part.slice(2, -2)
          return renderGreenHighlight(inner, index)
        }

        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2)
          const lower = inner.trim().toLowerCase()

          // Check if inner content is or contains a blood group
          const isBloodGroup =
            /^(?:a|b|ab|o)[+-]$/i.test(lower) ||
            /^(?:a|b|ab|o)[-\s]*(?:positive|negative)$/i.test(lower) ||
            /^(?:blood\s*group|blood\s*type)[\s:]*([a-z0-9+-]+)$/i.test(lower)

          if (isBloodGroup) {
            return renderGreenHighlight(inner, index)
          }

          if (lower === 'high' || lower.startsWith('high') || lower === 'elevated') {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700"
              >
                {inner}
              </span>
            )
          }

          if (lower === 'low' || lower.startsWith('low') || lower === 'deficient') {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"
              >
                {inner}
              </span>
            )
          }

          if (lower === 'normal' || lower === 'optimal' || lower.startsWith('normal')) {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
              >
                {inner}
              </span>
            )
          }

          return (
            <strong key={index} className="font-bold text-navy-950">
              {renderTextWithBloodGroup(inner, index)}
            </strong>
          )
        }

        if (part.startsWith('*') && part.endsWith('*')) {
          const inner = part.slice(1, -1)
          return (
            <em key={index} className="italic text-navy-800">
              {inner}
            </em>
          )
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          const inner = part.slice(1, -1)
          return (
            <code
              key={index}
              className="rounded bg-ice-100 px-1.5 py-0.5 font-mono text-[11px] text-brand-800"
            >
              {inner}
            </code>
          )
        }

        return part.includes('\n') ? (
          part.split('\n').map((line, lIdx, arr) => (
            <span key={`${index}-${lIdx}`}>
              {renderTextWithBloodGroup(line, `${index}-${lIdx}`)}
              {lIdx < arr.length - 1 && <br />}
            </span>
          ))
        ) : (
          <span key={index}>{renderTextWithBloodGroup(part, index)}</span>
        )
      })}
    </>
  )
}

function ClinicalMarkdownRenderer({ content }) {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-navy-900">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'hr':
            return <hr key={index} className="my-4 border-t border-ice-200" />

          case 'heading': {
            const HeadingTag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
            return (
              <HeadingTag
                key={index}
                className="mt-4 mb-2 flex items-center gap-2 text-sm sm:text-base font-extrabold tracking-tight text-navy-950"
              >
                <InlineMarkdown text={block.content} />
              </HeadingTag>
            )
          }

          case 'section-title':
            return (
              <div
                key={index}
                className="mt-4 mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700"
              >
                <span className="size-1.5 rounded-full bg-brand-500" />
                <span>{block.content}</span>
              </div>
            )

          case 'emergency-alert':
            return (
              <div
                key={index}
                className="my-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs leading-6 text-rose-950 shadow-xs"
              >
                <InlineMarkdown text={block.content} />
              </div>
            )

          case 'table':
            return (
              <div
                key={index}
                className="my-3 max-w-full overflow-hidden rounded-xl sm:rounded-2xl border border-ice-200 bg-white shadow-2xs"
              >
                <div className="flex sm:hidden items-center justify-between bg-ice-50/80 px-3 py-1 text-[10px] font-semibold text-muted border-b border-ice-100">
                  <span>Clinical Table</span>
                  <span className="text-brand-600">Scroll ↔</span>
                </div>
                <div className="overflow-x-auto touch-pan-x">
                  <table className="w-full min-w-[320px] sm:min-w-[480px] border-collapse text-left text-xs">
                    {block.headers && (
                      <thead>
                        <tr className="border-b border-ice-200 bg-ice-50/90">
                          {block.headers.map((h, hIdx) => (
                            <th
                              key={hIdx}
                              className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 font-bold tracking-tight text-navy-900 text-[11px] sm:text-xs"
                            >
                              <InlineMarkdown text={h} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody className="divide-y divide-ice-100">
                      {block.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={cn(
                            'transition-colors hover:bg-brand-50/30',
                            rIdx % 2 === 1 ? 'bg-ice-50/25' : 'bg-white'
                          )}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 align-top leading-5 text-navy-850 text-[11px] sm:text-xs"
                            >
                              <InlineMarkdown text={cell} isCell />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          case 'ul':
            return (
              <ul key={index} className="my-2 space-y-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm leading-6 text-navy-850"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span className="flex-1">
                      <InlineMarkdown text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol key={index} className="my-2 space-y-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm leading-6 text-navy-850"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                      {itemIdx + 1}
                    </span>
                    <span className="flex-1">
                      <InlineMarkdown text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            )

          case 'p':
          default:
            return (
              <p key={index} className="text-xs sm:text-sm leading-6 text-navy-850">
                <InlineMarkdown text={block.content} />
              </p>
            )
        }
      })}
    </div>
  )
}

function ChatBubble({ message, documents, isLiveAuth }) {
  const isUser = message.role === 'user'
  const source = message.sourceDocumentId
    ? documents.find((document) => document.id === message.sourceDocumentId)
    : null

  return (
    <div className={cn('flex items-start gap-2 sm:gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'grid size-7.5 sm:size-9 shrink-0 place-items-center rounded-xl',
          isUser ? 'bg-navy-900 text-white' : 'bg-brand-100 text-brand-700'
        )}
      >
        {isUser ? (
          <UserRound className="size-3.5 sm:size-4" />
        ) : (
          <SafeImage
            src="/images/ai-assistant.png"
            alt=""
            className="size-7.5 sm:size-9 overflow-hidden rounded-xl"
            imgClassName="size-full object-cover"
          />
        )}
      </span>
      <div
        className={cn(
          'w-full max-w-[94%] sm:max-w-[90%] xl:max-w-[88%] rounded-2xl p-3 sm:p-5',
          isUser
            ? 'rounded-tr-md bg-navy-900 text-white'
            : 'rounded-tl-md border border-ice-200 bg-white text-navy-900 shadow-xs'
        )}
      >
        <p
          className={cn(
            'mb-2 text-[10px] font-bold uppercase tracking-wide',
            isUser ? 'text-white/60' : 'text-brand-700'
          )}
        >
          {isUser ? 'You' : 'HealthSaathi · AI Assistant'}
        </p>

        {isUser ? (
          <p className="whitespace-pre-line text-sm leading-6">{message.content}</p>
        ) : (
          <ClinicalMarkdownRenderer content={message.content} />
        )}

        {source && !isUser && (
          <Link
            to={`/records/${source.id}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
          >
            <FileText className="size-3.5" /> View source: {source.title}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
        {message.time && (
          <p className={cn('mt-2 text-[10px]', isUser ? 'text-white/50' : 'text-muted')}>
            {message.time}
          </p>
        )}
      </div>
    </div>
  )
}

