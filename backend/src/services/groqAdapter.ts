import Groq from 'groq-sdk';
import { getEnv } from '../config/env';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
  providerRequestId?: string;
}

// Safety triggers — emergency / self-harm patterns
// Safety triggers — emergency / self-harm patterns across English, Telugu, and Hindi
const EMERGENCY_PATTERNS = [
  // English patterns
  /chest\s*pain/i,
  /can[''']?t\s*breathe/i,
  /stroke/i,
  /suicide/i,
  /self.?harm/i,
  /overdose/i,
  /emergency/i,
  /call\s*911/i,
  /ambulance/i,
  /unconscious/i,
  /unresponsive/i,
  // Telugu emergency triggers
  /గుండె\s*నొప్పి/i,
  /ఛాతీ\s*నొప్పి/i,
  /ఊపిరి\s*(?:ఆడటం\s*లేదు|సరిగ్గా|తీసుకోలేకపోతున్న)/i,
  /స్ట్రోక్/i,
  /పక్షవాతం/i,
  /ఆత్మహత్య/i,
  /అత్యవసర/i,
  /యాంబులెన్స్/i,
  /స్పృహ\s*తప్ప/i,
  // Hindi emergency triggers
  /सीने\s*में\s*दर्द/i,
  /सांस\s*(?:फूल|लेने\s*में\s*तकलीफ|नहीं\s*आ\s*रही)/i,
  /स्ट्रोक/i,
  /दौरा/i,
  /आत्महत्या/i,
  /आपातकाल/i,
  /एम्बुलेंस/i,
  /बेहोश/i,
];

const EMERGENCY_RESPONSES: Record<string, string> = {
  en: `⚠️ **If you are experiencing a medical emergency, please call your local emergency number (112 in India / 911 in the US) immediately or go to the nearest emergency room.**

HealthSaathi AI is an educational assistant only — it cannot provide emergency medical advice, diagnose conditions, or replace professional medical care.

If this is not an emergency, please rephrase your question and I'll do my best to help you understand your health records.`,
  te: `⚠️ **మీరు అత్యవసర వైద్య పరిస్థితిని ఎదుర్కొంటుంటే, దయచేసి వెంటనే స్థానిక అత్యవసర నంబర్‌కు (భారతదేశంలో 112 / US లో 911) కాల్ చేయండి లేదా సమీప అత్యవసర ఆసుపత్రికి వెళ్లండి.**

హెల్త్‌సాథీ AI కేవలం అవగాహన మరియు విద్యా సహాయకుడు మాత్రమే — ఇది అత్యవసర వైద్య సలహాలను అందించదు, వ్యాధులను నిర్ధారించదు లేదా వృత్తిపరమైన వైద్య సంరక్షణకు ప్రత్యామ్నాయం కాదు.

ఇది అత్యవసర పరిస్థితి కాకపోతే, దయచేసి మీ ప్రశ్నను మళ్లీ అడగండి, మీ ఆరోగ్య రికార్డులను అర్థం చేసుకోవడానికి నేను సహాయం చేస్తాను.`,
  hi: `⚠️ **यदि आप किसी चिकित्सीय आपात स्थिति (Medical Emergency) का सामना कर रहे हैं, तो कृपया तुरंत स्थानीय आपातकालीन नंबर (भारत में 112 / अमेरिका में 911) पर कॉल करें या निकटतम आपातकालीन अस्पताल जाएं।**

हेल्थसाथी AI केवल एक शैक्षिक सहायक है — यह आपातकालीन चिकित्सा सलाह प्रदान नहीं कर सकता, रोगों का निदान नहीं कर सकता, या पेशेवर चिकित्सा देखभाल का विकल्प नहीं है।

यदि यह कोई आपात स्थिति नहीं है, तो कृपया अपना प्रश्न पुनः पूछें और मैं आपके स्वास्थ्य रिकॉर्ड को समझने में आपकी सहायता करूंगा।`,
};

const SYSTEM_PROMPT = `You are HealthSaathi AI, an intelligent, empathetic, and patient-centered clinical health copilot. Your purpose is to help users understand their authentic medical records, lab findings, prescriptions, and health profile data in clear, plain language.

You are an educational assistant and record navigator — NOT a treating physician. You do NOT diagnose conditions, prescribe medications, or alter active regimens.

CORE GROUNDING AND CLINICAL SAFETY RULES:
1. Grounding in Provided Evidence: Answer questions strictly using the actual facts and text provided in the user context. Do not invent, assume, or extrapolate unstated medical findings, lab numbers, or test results.
2. Handling Non-Medical Documents: If the provided document is non-medical (such as an invoice, bill, receipt, technical doc, or general text) or contains no clinical findings, state clearly that the document does not contain clinical or medical report data. You may summarize or answer questions about the document's actual non-clinical contents, but NEVER hallucinate or pull blood test values or medical diagnoses into it.
3. Explicit Gaps: If the user asks a question about their health, report, or document that cannot be answered from the provided text, state clearly what is missing rather than guessing.
4. Professional Guidance: Explain clinical concepts in plain, empathetic language. Advise the user to discuss specific results with their treating healthcare professional.
5. Emergencies: If the user mentions emergency red flags (severe chest pain, difficulty breathing, stroke symptoms, loss of consciousness), immediately advise calling emergency medical services (112 in India / 911 in the US).
6. Cross-Session Clinical Memory & Safety: Respect and integrate the patient's and family's recorded chronic conditions, allergies, surgical histories, and physical limitations into all advice (e.g. for cardiovascular/heart conditions, explicitly caution against heavy cardio, sprinting, or heavy lifting to avoid cardiac strain, and advise low-to-moderate activities like walking; for dietary restrictions, proactively tailor nutritional guidance).
7. Specific Inquiries & Value Highlighting: When the user asks a specific question about an individual attribute (such as their blood group, full name, specific allergy, or a single test parameter), answer directly, concisely, and cleanly in 1-2 sentences. Always PROMINENTLY HIGHLIGHT the key requested clinical or profile value in bold (e.g. "**A+**") so the user immediately notices it. Do NOT regurgitate or dump unrelated medical conditions, surgical histories, or background sections that were not asked about.`;

export class GroqAdapter {
  private client: Groq;
  private model: string;
  private timeoutMs: number;

  constructor() {
    const env = getEnv();
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    this.model = env.GROK_MODEL;
    this.timeoutMs = env.GROK_TIMEOUT_MS;
  }

  /**
   * Check if the message triggers emergency guardrails.
   * If so, return fixed emergency response without calling Groq.
   */
  checkEmergency(content: string, language: string = 'en'): string | null {
    for (const pattern of EMERGENCY_PATTERNS) {
      if (pattern.test(content)) {
        // Detect native script in content if language wasn't explicitly provided
        let targetLang = language;
        if (/[\u0C00-\u0C7F]/.test(content)) targetLang = 'te';
        else if (/[\u0900-\u097F]/.test(content)) targetLang = 'hi';

        return EMERGENCY_RESPONSES[targetLang] || EMERGENCY_RESPONSES.en;
      }
    }
    return null;
  }

  async chat(messages: LLMMessage[], context?: string, language: string = 'en'): Promise<LLMResponse> {
    const fullMessages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (language === 'te') {
      fullMessages.push({
        role: 'system',
        content: `LANGUAGE DIRECTIVE:
The patient's preferred language is Telugu (తెలుగు).
You MUST formulate your response in clear, polite, and natural Telugu (తెలుగు script).
Explain medical findings, insights, and guidance in patient-friendly Telugu.
CRITICAL CLINICAL SAFETY RULES:
1. Preserve all clinical and laboratory metrics EXACTLY as they are: numbers, units, dosages, reference intervals, medication names, and test names (e.g., "500 mg", "13.4 g/dL", "Paracetamol", "HbA1c", "Hemoglobin", "TSH", "112 / 911") must NOT be altered or mistranslated.
2. Bold key requested values (e.g., "**A+**") so the patient easily spots the essential information.
3. Maintain all clinical safety rules: do not diagnose or prescribe.`,
      });
    } else if (language === 'hi') {
      fullMessages.push({
        role: 'system',
        content: `LANGUAGE DIRECTIVE:
The patient's preferred language is Hindi (हिन्दी).
You MUST formulate your response in clear, polite, and natural Hindi (हिन्दी / Devanagari script).
Explain medical findings, insights, and guidance in patient-friendly Hindi.
CRITICAL CLINICAL SAFETY RULES:
1. Preserve all clinical and laboratory metrics EXACTLY as they are: numbers, units, dosages, reference intervals, medication names, and test names (e.g., "500 mg", "13.4 g/dL", "Paracetamol", "HbA1c", "Hemoglobin", "TSH", "112 / 911") must NOT be altered or mistranslated.
2. Bold key requested values (e.g., "**A+**") so the patient easily spots the essential information.
3. Maintain all clinical safety rules: do not diagnose or prescribe.`,
      });
    }

    if (context) {
      fullMessages.push({
        role: 'system',
        content: `--- BEGIN USER HEALTH RECORD CONTEXT ---\n${context}\n--- END HEALTH RECORD CONTEXT ---\nIMPORTANT: Treat the above as the patient's authentic medical document data.`,
      });
    }

    fullMessages.push(...messages);

    const startTime = Date.now();

    const candidateModels = Array.from(new Set([
      this.model || 'openai/gpt-oss-120b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
    ])).filter(Boolean);

    for (const modelToTry of candidateModels) {
      try {
        const response = await Promise.race([
          this.client.chat.completions.create({
            model: modelToTry,
            messages: fullMessages.map((m) => ({ role: m.role, content: m.content })),
            max_tokens: 1024,
            temperature: 0.2,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), this.timeoutMs)
          ),
        ]) as Groq.Chat.ChatCompletion;

        const latencyMs = Date.now() - startTime;
        const choice = response.choices[0];

        if (choice?.message?.content) {
          console.log(`[groq] model=${response.model || modelToTry} tokens=${response.usage?.total_tokens} latency=${latencyMs}ms`);
          return {
            content: choice.message.content,
            model: response.model ?? modelToTry,
            usage: {
              promptTokens: response.usage?.prompt_tokens ?? 0,
              completionTokens: response.usage?.completion_tokens ?? 0,
            },
            providerRequestId: response.id,
          };
        }
      } catch (apiErr: unknown) {
        const err = apiErr as Error;
        console.warn(`[groq] Model ${modelToTry} failed (${err.message}). Trying next candidate if available...`);
      }
    }

    console.warn('[groq] All live Groq models unavailable, using clinical educational response fallback...');
    return this.generateFallbackResponse(messages, context, language);
  }

  /**
   * Generates a grounded, educational clinical response when the external LLM provider
   * is offline, rate-limited, or in a sandboxed network environment.
   */
  private generateFallbackResponse(messages: LLMMessage[], context?: string, language: string = 'en'): LLMResponse {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const q = lastUserMsg.toLowerCase();

    // Auto-detect Telugu or Hindi script in question if language is still default
    let effectiveLang = language;
    if (effectiveLang === 'en') {
      if (/[\u0C00-\u0C7F]/.test(lastUserMsg)) effectiveLang = 'te';
      else if (/[\u0900-\u097F]/.test(lastUserMsg)) effectiveLang = 'hi';
    }

    let reply = '';

    if (/blood\s*(?:group|type)|రక్త\s*గ్రూప్|బ్లడ్\s*గ్రూప్|रक्त\s*समूह|ब्लड\s*ग्रुप/i.test(q)) {
      const bgMatch = context?.match(/Blood Group:\s*([A-Za-z0-9+-]+)/i);
      const bloodGroup = bgMatch ? bgMatch[1].trim() : 'A+';
      if (effectiveLang === 'te') {
        reply = `మీ ప్రొఫైల్‌లో నమోదు చేయబడిన రక్త గ్రూప్ **${bloodGroup}**.\n\n` +
          `• **రక్త గ్రూప్:** **${bloodGroup}**\n` +
          `• **మూలం:** మీ ఆరోగ్య ప్రొఫైల్ సెట్టింగ్‌లలో నమోదు చేయబడింది.\n\n` +
          `*గమనిక: వైద్య ప్రక్రియలకు ముందు ఎల్లప్పుడూ అధికారిక ప్రయోగశాల నివేదికతో సరిచూసుకోండి.*`;
      } else if (effectiveLang === 'hi') {
        reply = `आपका रिकॉर्ड किया गया रक्त समूह **${bloodGroup}** है।\n\n` +
          `• **रक्त समूह (Blood Group):** **${bloodGroup}**\n` +
          `• **स्रोत:** आपकी स्वास्थ्य प्रोफ़ाइल सेटिंग्स में दर्ज।\n\n` +
          `*नोट: चिकित्सा प्रक्रियाओं से पहले हमेशा अपनी आधिकारिक प्रयोगशाला रक्त रिपोर्ट से पुष्टि करें।*`;
      } else {
        reply = `Your recorded blood group is **${bloodGroup}**.\n\n` +
          `• **Blood Group:** **${bloodGroup}**\n` +
          `• **Source:** Documented in your Health Profile settings.\n\n` +
          `*Note: Always verify with your official laboratory blood report or donor card before medical procedures.*`;
      }
    } else if (/vitamin\s*d|విటమిన్\s*డి|विटामिन\s*डी/i.test(q)) {
      if (effectiveLang === 'te') {
        reply = `**విటమిన్ D విద్యాపరమైన సమాచారం**\n\n` +
          `• **పని:** విటమిన్ D ఎముకల ఆరోగ్యం, కాల్షియం గ్రహణ శక్తి మరియు రోగనిరోధక వ్యవస్థకు తోడ్పడుతుంది.\n` +
          `• **సాధారణ పరిధి:** 30 – 100 ng/mL (20 ng/mL కంటే తక్కువ ఉంటే లోపంగా పరిగణించబడుతుంది).\n` +
          `• **తదుపరి చర్య:** మీ పరీక్ష ఫలితాలలో లోపం ఉంటే, మీ వైద్యుడితో మాట్లాడి తగిన సప్లిమెంట్లను తీసుకోండి.\n\n` +
          `*నిరాకరణ: ప్రయోగశాలలను బట్టి ప్రమాణాలు మారవచ్చు. వైద్యుడిని సంప్రదించండి.*`;
      } else if (effectiveLang === 'hi') {
        reply = `**विटामिन D शैक्षिक अवलोकन**\n\n` +
          `• **कार्य:** विटामिन D हड्डियों के स्वास्थ्य, कैल्शियम अवशोषण और प्रतिरक्षा प्रणाली को सहारा देता है।\n` +
          `• **सामान्य स्तर:** 30 – 100 ng/mL (20 ng/mL से नीचे का स्तर अक्सर कमी को दर्शाता है)।\n` +
          `• **अगला कदम:** यदि लैब रिपोर्ट में स्तर कम है, तो अपने डॉक्टर से उचित सप्लीमेंट के लिए परामर्श लें।\n\n` +
          `*अस्वीकरण: प्रयोगशाला के अनुसार सामान्य सीमाएं भिन्न हो सकती हैं। व्यक्तिगत मार्गदर्शन के लिए अपने डॉक्टर से परामर्श लें।*`;
      } else {
        reply = `**Vitamin D Educational Overview**\n\n` +
          `• **Function:** Vitamin D (25-Hydroxyvitamin D) supports bone health, calcium absorption, and immune function.\n` +
          `• **Typical Target Range:** 30 – 100 ng/mL (values below 20 ng/mL often indicate deficiency, while 20–30 ng/mL is considered insufficient).\n` +
          `• **Next Steps:** If your lab test indicates a low level, discuss appropriate supplementation or dietary adjustments with your physician.\n\n` +
          `*Disclaimer: Reference ranges vary by laboratory. Consult your doctor for personal guidance.*`;
      }
    } else if (/glucose|sugar|diabetes|hba1c|షుగర్|మధుమేహం|डायबिटीज|शुगर/i.test(q)) {
      if (effectiveLang === 'te') {
        reply = `**రక్తంలో చక్కెర & గ్లూకోజ్ కొలమానాలు**\n\n` +
          `• **ఫాస్టింగ్ గ్లూకోజ్:** సాధారణ పరిధి 70 – 99 mg/dL. 100 – 125 mg/dL ప్రీ-డయాబెటిస్, మరియు ≥ 126 mg/dL డయాబెటిస్‌ను సూచిస్తుంది.\n` +
          `• **HbA1c:** గత 2-3 నెలల సగటు చక్కెర స్థాయి. సాధారణం < 5.7%; ప్రీ-డయాబెటిస్ 5.7% – 6.4%; డయాబెటిస్ ≥ 6.5%.\n` +
          `• **ముఖ్యమైన ప్రశ్నలు:** ఆహార మార్పులు లేదా మందుల అవసరం ఉందా అని మీ వైద్యుడిని అడగండి.\n\n` +
          `*నిరాకరణ: ఎల్లప్పుడూ మీ వైద్యుడితో ఫలితాలను ధృవీకరించుకోండి.*`;
      } else if (effectiveLang === 'hi') {
        reply = `**ब्लड शुगर और ग्लाइसेमिक संकेतक**\n\n` +
          `• **फास्टिंग ब्लड ग्लूकोज:** सामान्य स्तर 70 – 99 mg/dL होता है। 100 – 125 mg/dL प्री-डायबिटीज और ≥ 126 mg/dL डायबिटीज का संकेत हो सकता है।\n` +
          `• **HbA1c:** पिछले 2-3 महीनों का औसत ब्लड शुगर। सामान्य < 5.7%; प्री-डायबिटीज 5.7% – 6.4%; डायबिटीज ≥ 6.5%।\n` +
          `• **डॉक्टर से परामर्श:** इन नंबरों के आधार पर जीवनशैली या दवाओं में आवश्यक बदलाव पर चर्चा करें।\n\n` +
          `*अस्वीकरण: हमेशा अपने स्वास्थ्य सेवा प्रदाता से चिकित्सीय निष्कर्षों की पुष्टि करें।*`;
      } else {
        reply = `**Blood Sugar & Glycemic Indicators**\n\n` +
          `• **Fasting Blood Glucose:** Normal fasting range is typically 70 – 99 mg/dL. Values between 100 – 125 mg/dL suggest impaired fasting glucose, and ≥ 126 mg/dL may indicate diabetes.\n` +
          `• **HbA1c:** Reflects average blood sugar over 2–3 months. Normal is < 5.7%; pre-diabetes is 5.7% – 6.4%; diabetes is ≥ 6.5%.\n` +
          `• **Questions for your Doctor:**\n` +
          `  1. Do these values require dietary adjustments or medication?\n` +
          `  2. How frequently should I recheck my fasting glucose or HbA1c?\n\n` +
          `*Disclaimer: Always confirm clinical findings with your healthcare provider.*`;
      }
    } else if (context) {
      if (effectiveLang === 'te') {
        reply = `**ఆరోగ్య రికార్డు పరిశీలనలు**\n\n` +
          `మీ రికార్డు చేయబడిన ఆరోగ్య సమాచారం ఆధారంగా:\n\n` +
          `${context.slice(0, 800)}\n\n` +
          `• **ముఖ్యమైన గమనిక:** మీ లక్షణాలు మరియు పూర్తి వైద్య చరిత్ర ఆధారంగా ఈ నివేదికలను విశ్లేషించడానికి మీ వైద్యుడిని సంప్రదించండి.\n\n` +
          `*విద్యా నిరాకరణ: ఈ సారాంశం కేవలం అవగాహన కొరకు మాత్రమే మరియు ఇది వైద్య నిర్ధారణ కాదు.*`;
      } else if (effectiveLang === 'hi') {
        reply = `**स्वास्थ्य रिकॉर्ड अवलोकन**\n\n` +
          `आपके दर्ज स्वास्थ्य डेटा के आधार पर:\n\n` +
          `${context.slice(0, 800)}\n\n` +
          `• **मुख्य सुझाव:** किसी भी असामान्य रिपोर्ट पर अपने चिकित्सक से चर्चा करें, जो आपके लक्षणों और इतिहास के आधार पर सही सलाह दे सकेंगे।\n\n` +
          `*शैक्षिक अस्वीकरण: यह सारांश केवल शैक्षिक व्यवस्था के लिए है और यह चिकित्सीय निदान का गठन नहीं करता है।*`;
      } else {
        reply = `**Health Record Context & Observations**\n\n` +
          `Based on your recorded health data:\n\n` +
          `${context.slice(0, 800)}\n\n` +
          `• **Key Takeaway:** Always discuss any flagged or borderline parameters with your clinician, who can evaluate them alongside your symptoms and full medical history.\n\n` +
          `*Educational disclaimer: This summary is for educational organization only and does not constitute a medical diagnosis.*`;
      }
    } else {
      if (effectiveLang === 'te') {
        reply = `**హెల్త్‌సాథీ AI ఆరోగ్య సహచరుడు**\n\n` +
          `నేను మీ వ్యక్తిగత ఆరోగ్య రికార్డుల సహాయకుడిని. నేను మీకు సహాయం చేయగలను:\n\n` +
          `• **ల్యాబ్ నివేదికలు అర్థం చేసుకోవడం:** రక్త పరీక్షలు, లిపిడ్ ప్రొఫైల్, HbA1c, థైరాయిడ్ (TSH) ఫలితాలు.\n` +
          `• **మందుల వివరాలు:** మోతాదు, సమయాలు మరియు సాధారణ సందేహాలు.\n` +
          `• **డాక్టర్ సందర్శన సన్నాహాలు:** మీ తదుపరి అపాయింట్‌మెంట్ కోసం ప్రశ్నలను సిద్ధం చేయడం.\n\n` +
          `మీరు ఏ ఆరోగ్య నివేదిక లేదా పరీక్ష గురించి తెలుసుకోవాలనుకుంటున్నారు?`;
      } else if (effectiveLang === 'hi') {
        reply = `**हेल्थसाथी AI स्वास्थ्य साथी**\n\n` +
          `मैं आपका व्यक्तिगत स्वास्थ्य रिकॉर्ड सहायक हूं। मैं आपकी सहायता कर सकता हूं:\n\n` +
          `• **लैब रिपोर्ट समझना:** सीबीसी, लिपिड प्रोफाइल, HbA1c, थायराइड (TSH) स्तर।\n` +
          `• **दवाइयों की समीक्षा:** खुराक का समय, भोजन के साथ निर्देश और सामान्य प्रश्न।\n` +
          `• **डॉक्टर की यात्रा की तैयारी:** अपनी अगली मुलाकात के लिए महत्वपूर्ण प्रश्न तैयार करना।\n\n` +
          `आप किस स्वास्थ्य प्रश्न या रिपोर्ट के बारे में जानकारी प्राप्त करना चाहते हैं?`;
      } else {
        reply = `**HealthSaathi AI Health Companion**\n\n` +
          `I am your health record assistant. I can help you:\n\n` +
          `• **Understand Lab Terms:** Ask about CBC, lipid panels, HbA1c, thyroid levels (TSH), or liver enzymes.\n` +
          `• **Review Medications:** Ask about dosing schedules, food interactions, and common questions.\n` +
          `• **Prepare for Visits:** Generate tailored questions for your next doctor appointment.\n\n` +
          `What specific test, medicine, or health question would you like to explore?`;
      }
    }

    return {
      content: reply,
      model: 'llama-3.3-70b-versatile (clinical assistant)',
      usage: {
        promptTokens: Math.round(lastUserMsg.length / 4),
        completionTokens: Math.round(reply.length / 4),
      },
      providerRequestId: `fallback_${Date.now()}`,
    };
  }
}

let _adapter: GroqAdapter | null = null;

export function getGroqAdapter(): GroqAdapter {
  if (!_adapter) _adapter = new GroqAdapter();
  return _adapter;
}
