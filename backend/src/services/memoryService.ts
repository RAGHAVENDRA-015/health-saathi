import { ObjectId } from 'mongodb';
import { getDb } from '../config/mongo';
import { ClinicalMemoryDoc, MemoryCategory, UserDoc } from '../types/models';
import { getGroqAdapter } from './groqAdapter';

// Fast pre-filter regex: only trigger memory extraction when message contains medical/family disclosure keywords
const MEMORY_HEURISTIC_REGEX = /\b(heart|cardio|chest|cardiac|stent|bypass|angioplasty|attack|pressure|bp|hypertens|hypotens|sugar|diabet|glucose|hba1c|insulin|asthma|inhaler|respiratory|breath|lung|allergy|allergic|penicillin|sulfa|peanut|nsaid|aspirin|ibuprofen|kidney|renal|dialysis|creatinine|liver|cirrhosis|thyroid|tsh|cancer|tumor|stroke|cholesterol|lipid|triglyceride|gout|arthritis|surgery|operated|transplant|pregnant|pregnancy|father|mother|dad|mom|parent|spouse|wife|husband|son|daughter|brother|sister|child|kid|restriction|cannot lift|heavy lift|diet|salt|sodium|sugar-free|vegetarian|vegan|renal diet)\b/i;

interface ExtractedMemoryItem {
  subject: string;
  category: MemoryCategory;
  fact: string;
  clinicalPrecaution?: string;
  confidence: number;
}

export class MemoryService {
  private memoryCache = new Map<string, { context: string; timestamp: number }>();

  /**
   * Retrieves active persistent memories for the patient and their family members,
   * combining user profile baseline data with durable memories extracted from prior chats.
   */
  async getClinicalMemoriesContext(ownerId: string): Promise<string> {
    if (!ownerId) return '';

    const cached = this.memoryCache.get(ownerId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.context;
    }

    try {
      const db = getDb();

      // 1 & 2. Fetch user's structured profile baseline and clinical memories concurrently
      const [user, memories] = await Promise.all([
        db.collection<UserDoc>('users').findOne({ firebaseUid: ownerId } as never),
        db.collection<ClinicalMemoryDoc>('clinical_memories')
          .find({
            ownerId,
            $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
          } as never)
          .sort({ updatedAt: -1 })
          .limit(20)
          .toArray(),
      ]);

      let profileBaseline = '';
      if (user) {
        const profileItems: string[] = [];
        if (user.displayName || user.fullName) profileItems.push(`  • Patient: ${user.fullName || user.displayName}`);
        if (user.age) profileItems.push(`  • Age: ${user.age}`);
        if (user.bloodGroup) profileItems.push(`  • Blood Group: ${user.bloodGroup}`);
        if (user.allergies && user.allergies.trim()) profileItems.push(`  • Documented Allergies: ${user.allergies.trim()}`);
        if (user.conditions && user.conditions.trim()) profileItems.push(`  • Known Chronic Conditions: ${user.conditions.trim()}`);
        if (user.healthNotes && user.healthNotes.trim()) profileItems.push(`  • Clinical Health Notes / Precautions: ${user.healthNotes.trim()}`);
        if (user.emergencyContact) profileItems.push(`  • Emergency Contact: ${typeof user.emergencyContact === 'string' ? user.emergencyContact : JSON.stringify(user.emergencyContact)}`);

        if (profileItems.length > 0) {
          profileBaseline = `--- PATIENT BASELINE PROFILE (FROM HEALTH PROFILE SETTINGS) ---\n${profileItems.join('\n')}`;
        }
      }

      let crossSessionSection = '';
      if (memories && memories.length > 0) {
        const lines: string[] = [];
        for (const m of memories) {
          const subjectTag = m.subject?.toUpperCase() === 'SELF' ? 'PATIENT (SELF)' : `FAMILY (${m.subject?.toUpperCase()})`;
          const precautionText = m.clinicalPrecaution ? ` | Precaution: ${m.clinicalPrecaution}` : '';
          lines.push(`  • [${subjectTag}] ${m.category.replace(/_/g, ' ')}: ${m.fact}${precautionText}`);
        }
        crossSessionSection = `--- PATIENT & FAMILY PERSISTENT CLINICAL PROFILE (CROSS-SESSION MEMORY) ---
The following durable health conditions, history, and medical precautions have been documented across prior consultations:
${lines.join('\n')}`;
      }

      if (!profileBaseline && !crossSessionSection) return '';

      const sections: string[] = [];
      if (profileBaseline) sections.push(profileBaseline);
      if (crossSessionSection) sections.push(crossSessionSection);

      sections.push(`CLINICAL INSTRUCTION FOR ASSISTANT:
1. Always cross-reference user questions against the patient's baseline profile and persistent conditions above without asking the user to repeat them.
2. If the patient has known allergies (e.g. penicillin, NSAIDs, food): strictly warn and verify safety before suggesting any remedies or medications.
3. For cardiac/heart conditions or physical restrictions: strictly recommend low-to-moderate intensity activities (e.g. walking, gentle cycling) and explicitly warn against heavy cardio, sprinting, or sudden exertion.
4. For dietary restrictions, diabetic conditions, or hypertension: tailor precautions, meal suggestions, and exercise safety strictly around these recorded facts.
5. If blood group or emergency contact is relevant (e.g. emergency consultations, acute crisis, surgical inquiries), reference these documented attributes.
---`);

      const result = sections.join('\n\n');
      this.memoryCache.set(ownerId, { context: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.warn('[memoryService] Failed to load clinical memories:', err);
      return '';
    }
  }

  /**
   * Synchronizes user profile attributes (allergies, conditions, healthNotes)
   * into persistent clinical memories so they are permanently preserved.
   */
  async syncProfileToClinicalMemories(ownerId: string, profile: Partial<UserDoc>): Promise<void> {
    if (!ownerId) return;

    try {
      const db = getDb();
      const now = new Date();

      // Sync Allergies
      if (profile.allergies && profile.allergies.trim()) {
        const allergyItems = profile.allergies.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        for (const allergy of allergyItems) {
          await db.collection<ClinicalMemoryDoc>('clinical_memories').updateOne(
            { ownerId, subject: 'SELF', category: 'ALLERGY', fact: `Allergy: ${allergy}` } as never,
            {
              $set: {
                ownerId,
                subject: 'SELF',
                category: 'ALLERGY',
                fact: `Allergy: ${allergy}`,
                clinicalPrecaution: `Avoid medications, ingredients, or compounds containing ${allergy}`,
                sourceText: 'Patient Profile Settings',
                confidence: 1.0,
                updatedAt: now,
                deletedAt: null as never,
                schemaVersion: 1,
              },
              $setOnInsert: { createdAt: now },
            },
            { upsert: true }
          );
        }
      }

      // Sync Conditions
      if (profile.conditions && profile.conditions.trim()) {
        const conditionItems = profile.conditions.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        for (const cond of conditionItems) {
          let precaution = `Monitor symptoms and manage condition closely with regular medical supervision`;
          const lower = cond.toLowerCase();
          if (lower.includes('heart') || lower.includes('cardio') || lower.includes('coronary') || lower.includes('angina')) {
            precaution = 'Advise low-to-moderate intensity exercises only (e.g. walking); avoid heavy cardio, sprinting, or strenuous exertion';
          } else if (lower.includes('diabet') || lower.includes('sugar')) {
            precaution = 'Maintain low-glycemic dietary balance; avoid sudden fasting or high-sugar intake and monitor glucose';
          } else if (lower.includes('hypertens') || lower.includes('bp') || lower.includes('pressure')) {
            precaution = 'Maintain low-sodium dietary habits, avoid excessive stress, and monitor resting blood pressure';
          } else if (lower.includes('asthma') || lower.includes('respirat')) {
            precaution = 'Avoid extreme cold air exertion; keep quick-relief rescue inhaler accessible';
          }

          await db.collection<ClinicalMemoryDoc>('clinical_memories').updateOne(
            { ownerId, subject: 'SELF', category: 'CHRONIC_CONDITION', fact: `Condition: ${cond}` } as never,
            {
              $set: {
                ownerId,
                subject: 'SELF',
                category: 'CHRONIC_CONDITION',
                fact: `Condition: ${cond}`,
                clinicalPrecaution: precaution,
                sourceText: 'Patient Profile Settings',
                confidence: 1.0,
                updatedAt: now,
                deletedAt: null as never,
                schemaVersion: 1,
              },
              $setOnInsert: { createdAt: now },
            },
            { upsert: true }
          );
        }
      }

      // Sync Health Notes
      if (profile.healthNotes && profile.healthNotes.trim()) {
        await db.collection<ClinicalMemoryDoc>('clinical_memories').updateOne(
          { ownerId, subject: 'SELF', category: 'OTHER_PRECAUTION', fact: `Health Notes: ${profile.healthNotes.trim().slice(0, 100)}` } as never,
          {
            $set: {
              ownerId,
              subject: 'SELF',
              category: 'OTHER_PRECAUTION',
              fact: `Health Notes: ${profile.healthNotes.trim().slice(0, 100)}`,
              clinicalPrecaution: profile.healthNotes.trim(),
              sourceText: 'Patient Profile Settings',
              confidence: 1.0,
              updatedAt: now,
              deletedAt: null as never,
              schemaVersion: 1,
            },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn('[memoryService] Profile sync error:', err);
    }
  }

  /**
   * Asynchronously analyzes a conversation turn and persists durable health facts
   * about the patient or their family members. Runs silently without blocking the chat.
   */
  async extractAndPersistMemories(
    ownerId: string,
    conversationId: ObjectId | undefined,
    userMessage: string,
    assistantReply?: string
  ): Promise<void> {
    if (!ownerId || !userMessage || userMessage.trim().length < 8) return;

    // Fast gate: skip messages with no medical, chronic condition, or family history indicators
    if (!MEMORY_HEURISTIC_REGEX.test(userMessage)) {
      return;
    }

    try {
      const groq = getGroqAdapter();
      const extractionPrompt = `You are a clinical memory extraction assistant.
Analyze the user's message and extract any permanent/chronic health facts, chronic diseases, surgeries, allergies, dietary constraints, physical restrictions, or family health histories.

Target Categories:
- CHRONIC_CONDITION (e.g., heart disease, hypertension, type 2 diabetes, asthma)
- ALLERGY (e.g., penicillin allergy, severe peanut allergy)
- SURGICAL_HISTORY (e.g., heart stent placed, appendectomy, bypass surgery)
- PHYSICAL_RESTRICTION (e.g., avoid heavy weights, avoid high-impact running/heavy cardio)
- DIETARY_PREFERENCE (e.g., strictly low-sodium diet, diabetic diet, renal diet)
- FAMILY_HISTORY (e.g., father has diabetes, mother had cardiac arrest)
- OTHER_PRECAUTION

Subject Determination:
- 'SELF' if referring to the user themselves ("I have...", "my doctor said...", "I had surgery")
- 'FATHER', 'MOTHER', 'SPOUSE', 'CHILD', 'BROTHER', 'SISTER' if referring to family members

IMPORTANT:
- Ignore temporary acute complaints (e.g. "I have a headache right now", "I'm tired today", "I had pizza for lunch").
- Only extract long-term, chronic, or clinically significant facts.
- Formulate a clear, actionable 'clinicalPrecaution' for each fact (e.g. for heart disease: "Keep cardio low-to-moderate intensity (e.g. walking); avoid strenuous cardio, sprinting, or heavy lifting to prevent cardiac strain").

Return ONLY valid JSON with this structure (no markdown, no quotes around output):
{"memories": [{"subject": "SELF", "category": "CHRONIC_CONDITION", "fact": "History of heart-related disease", "clinicalPrecaution": "Avoid high-intensity cardio and heavy cardiac strain; recommend gentle low-impact exercises like walking", "confidence": 0.95}]}
If no persistent health facts are found, return {"memories": []}.

User message:
"""${userMessage.slice(0, 1500)}"""`;

      const response = await groq.chat([
        { role: 'system', content: 'You are an accurate clinical information extraction engine that responds ONLY with valid JSON.' },
        { role: 'user', content: extractionPrompt },
      ]);

      const cleanedContent = response.content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedContent) as { memories?: ExtractedMemoryItem[] };
      const items = Array.isArray(parsed?.memories) ? parsed.memories : [];

      if (items.length === 0) return;

      const db = getDb();
      const now = new Date();

      for (const item of items) {
        if (!item.fact || item.confidence < 0.7) continue;

        const subject = (item.subject || 'SELF').trim().toUpperCase();
        const category = item.category || 'CHRONIC_CONDITION';

        // Check if a similar memory already exists for this subject & category
        const existing = await db.collection<ClinicalMemoryDoc>('clinical_memories').findOne({
          ownerId,
          subject,
          category,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        } as never);

        if (existing) {
          // Update precaution and refresh timestamp
          await db.collection<ClinicalMemoryDoc>('clinical_memories').updateOne(
            { _id: existing._id } as never,
            {
              $set: {
                fact: item.fact,
                clinicalPrecaution: item.clinicalPrecaution || existing.clinicalPrecaution,
                sourceText: userMessage.slice(0, 500),
                sourceConversationId: conversationId,
                confidence: item.confidence,
                updatedAt: now,
              },
            }
          );
          console.log(`[memoryService] 🔄 Updated persistent memory for ${subject}: ${item.fact}`);
        } else {
          // Insert new persistent memory
          const newDoc: ClinicalMemoryDoc = {
            ownerId,
            subject,
            category,
            fact: item.fact,
            clinicalPrecaution: item.clinicalPrecaution,
            sourceText: userMessage.slice(0, 500),
            sourceConversationId: conversationId,
            confidence: item.confidence,
            createdAt: now,
            updatedAt: now,
            deletedAt: null as never,
            schemaVersion: 1,
          };
          await db.collection<ClinicalMemoryDoc>('clinical_memories').insertOne(newDoc as never);
          console.log(`[memoryService] 🧠 Learned new persistent clinical memory for ${subject}: ${item.fact}`);
        }
      }
    } catch (err) {
      console.warn('[memoryService] Memory extraction warning (silent):', err);
    }
  }

  /**
   * List active memories for the user
   */
  async listMemories(ownerId: string): Promise<ClinicalMemoryDoc[]> {
    const db = getDb();
    return await db
      .collection<ClinicalMemoryDoc>('clinical_memories')
      .find({
        ownerId,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      } as never)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Soft-delete a memory by ID
   */
  async deleteMemory(ownerId: string, memoryId: ObjectId): Promise<boolean> {
    const db = getDb();
    const res = await db.collection<ClinicalMemoryDoc>('clinical_memories').updateOne(
      { _id: memoryId, ownerId } as never,
      { $set: { deletedAt: new Date(), updatedAt: new Date() } }
    );
    return res.modifiedCount > 0;
  }
}

let _memoryService: MemoryService | null = null;
export function getMemoryService(): MemoryService {
  if (!_memoryService) _memoryService = new MemoryService();
  return _memoryService;
}
