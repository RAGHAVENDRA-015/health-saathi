import { apiClient } from './apiClient.js'
import { env } from '../../config/env.js'
import { storageService } from '../storageService.js'

const CONVERSATIONS_KEY = 'copilot_conversations'
const MESSAGES_PREFIX = 'copilot_msgs_'

// Fast in-memory cache for instant switching between chats
const messageMemoryCache = new Map()

/**
 * Strips markdown formatting syntax (asterisks, bold, headers, blockquotes, links)
 * to produce clean plain-text conversation previews without raw markdown characters.
 */
export function stripMarkdown(text) {
  if (!text) return ''
  return String(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^[\s]*[-+*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getLocalConversations() {
  return storageService.get(CONVERSATIONS_KEY, []) || []
}

function saveLocalConversations(list) {
  storageService.set(CONVERSATIONS_KEY, list)
}

function getLocalMessages(convId) {
  if (!convId) return []
  const key = String(convId)
  if (messageMemoryCache.has(key)) {
    return messageMemoryCache.get(key)
  }
  const loaded = storageService.get(`${MESSAGES_PREFIX}${key}`, []) || []
  if (loaded && loaded.length > 0) {
    messageMemoryCache.set(key, loaded)
  }
  return loaded
}

function saveLocalMessages(convId, msgs) {
  if (!convId) return
  const key = String(convId)
  messageMemoryCache.set(key, msgs)
  storageService.set(`${MESSAGES_PREFIX}${key}`, msgs)
}

/**
 * Direct Groq LLM call using patient records context when backend is restarting or unreachable.
 */
async function callDirectGroq(content, context, history = [], language = 'en') {
  const apiKey = env.groqApiKey
  if (!apiKey) return null

  let langDirective = ''
  if (language === 'te') {
    langDirective = '\n\nLANGUAGE DIRECTIVE: The user has selected Telugu (తెలుగు). Respond primarily in natural, empathetic, professional Telugu. Preserve all medical terminology, medication names, lab values, numbers, and clinical units (e.g., 500 mg, 13.4 g/dL, 92 mg/dL) accurately.'
  } else if (language === 'hi') {
    langDirective = '\n\nLANGUAGE DIRECTIVE: The user has selected Hindi (हिन्दी). Respond primarily in natural, empathetic, professional Hindi. Preserve all medical terminology, medication names, lab values, numbers, and clinical units (e.g., 500 mg, 13.4 g/dL, 92 mg/dL) accurately.'
  }

  const systemPrompt = `You are HealthSaathi AI, a personal clinical health copilot and intelligent medical record assistant.

CORE CLINICAL INTELLIGENCE GUIDELINES:
1. You have direct access to the user's authentic medical records, lab reports, biomarkers, and medications in the context.
2. Directly analyze and cite the patient's specific lab values, reference ranges, and abnormal flags (e.g. LOW Vitamin D at 28 ng/mL, HIGH Triglycerides at 162 mg/dL, Fasting Glucose at 92 mg/dL, Hemoglobin at 13.2 g/dL).
3. Present medical data cleanly using Markdown bullet points or tables with clear clinical interpretations:
   - What the test measures and what normal reference ranges represent
   - The patient's specific recorded values and whether they are optimal, borderline, high, or low
   - Practical, non-prescriptive lifestyle and dietary guidance
   - 3-4 structured questions the patient can take to their upcoming doctor's visit
4. Never describe the patient's records as "fictional", "sample", or "simulated". Treat them as authentic patient health records.
5. Provide a concise educational disclaimer at the end.${langDirective}`

  const messages = [{ role: 'system', content: systemPrompt }]
  if (context) {
    messages.push({
      role: 'system',
      content: `--- PATIENT HEALTH RECORDS CONTEXT ---\n${context}\n--- END RECORDS CONTEXT ---`,
    })
  }

  if (Array.isArray(history)) {
    history.slice(-4).forEach((h) => {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content })
      }
    })
  }
  messages.push({ role: 'user', content })

  const candidateModels = [
    env.groqModel || 'openai/gpt-oss-120b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ]

  for (const model of candidateModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 1024,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) {
          return {
            message: {
              content: text,
              role: 'assistant',
              model: `${model} (live Groq)`,
              createdAt: new Date().toISOString(),
            },
            model,
          }
        }
      }
    } catch (err) {
      console.warn(`[copilotApi] Direct Groq model ${model} attempt failed:`, err)
    }
  }

  return null
}

export const copilotApi = {
  async getConversations(params = {}) {
    let backendItems = []
    try {
      const raw = await apiClient.get('copilot/conversations', { params })
      backendItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    } catch (err) {
      console.warn('[copilotApi] getConversations backend warning:', err.message)
    }

    const localItems = getLocalConversations()
    if (backendItems.length === 0) {
      return localItems
    }

    // Merge backend and local conversations by ID, prioritizing backend
    const seen = new Set()
    const merged = []
    for (const item of backendItems) {
      const id = item.id || item._id
      if (id && !seen.has(id)) {
        seen.add(id)
        if (item.lastMessagePreview) {
          item.lastMessagePreview = stripMarkdown(item.lastMessagePreview)
        }
        merged.push(item)
      }
    }
    for (const item of localItems) {
      const id = item.id || item._id
      if (id && !seen.has(id)) {
        seen.add(id)
        if (item.lastMessagePreview) {
          item.lastMessagePreview = stripMarkdown(item.lastMessagePreview)
        }
        merged.push(item)
      }
    }

    merged.sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.createdAt || 0))
    saveLocalConversations(merged)
    return merged
  },

  async createConversation({ title, sourceDocumentId } = {}) {
    let created = null
    try {
      created = await apiClient.post('copilot/conversations', { title, sourceDocumentId })
    } catch (err) {
      console.warn('[copilotApi] createConversation via backend failed:', err.message)
    }

    const convId = created?._id || created?.id || `local-conv-${Date.now()}`
    const convObj = {
      ...(created || {}),
      _id: convId,
      id: convId,
      title: title || created?.title || 'Health Consultation',
      sourceDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
      createdAt: created?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    }

    // Save to local cache
    const currentList = getLocalConversations()
    const filtered = currentList.filter((c) => (c._id || c.id) !== convId)
    saveLocalConversations([convObj, ...filtered])

    return convObj
  },

  /**
   * Synchronously returns cached messages for immediate zero-latency render
   */
  getCachedMessages(conversationId) {
    if (!conversationId) return []
    return getLocalMessages(conversationId)
  },

  async getMessages(conversationId, params = {}) {
    if (!conversationId) return []
    const key = String(conversationId)
    let backendMessages = []
    try {
      const raw = await apiClient.get(`copilot/conversations/${key}/messages`, { params })
      backendMessages = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    } catch (err) {
      console.warn('[copilotApi] getMessages backend warning:', err.message)
    }

    if (backendMessages.length > 0) {
      saveLocalMessages(key, backendMessages)
      return backendMessages
    }

    return getLocalMessages(key)
  },

  /**
   * Send user message to conversation and receive copilot assistant reply.
   * Resiliently uses backend live LLM, with automatic direct Groq fallback,
   * guaranteeing conversation and message storage in both online and fallback states.
   */
  async sendMessage(conversationId, { content, sourceDocumentId, context, history = [], language = 'en' } = {}) {
    const targetConvId = conversationId && !String(conversationId).startsWith('local-') ? conversationId : null

    // 1. Try backend API first
    try {
      const convParam = targetConvId || 'default'
      const res = await apiClient.post(`copilot/conversations/${convParam}/messages`, {
        content,
        sourceDocumentId,
        context,
        language,
      })
      if (res?.message?.content || res?.content) {
        const finalConvId = res?.conversationId || targetConvId || 'default'
        this._recordMessageInLocalCache(
          finalConvId,
          content,
          res?.message?.content || res?.content,
          sourceDocumentId
        )
        return res
      }
    } catch (err) {
      console.warn('[copilotApi] Backend sendMessage failed, activating direct Groq LLM inference:', err.message)
    }

    // 2. Direct live Groq LLM inference fallback
    const directRes = await callDirectGroq(content, context, history, language)
    if (directRes?.message?.content) {
      const fallbackConvId = targetConvId || `local-conv-${Date.now()}`
      directRes.conversationId = fallbackConvId
      this._recordMessageInLocalCache(fallbackConvId, content, directRes.message.content, sourceDocumentId)
      return directRes
    }

    // 3. Fallback when both backend and direct Groq are unavailable
    throw new Error('AI inference service is currently unavailable. Activating clinical knowledge engine.')
  },

  _recordMessageInLocalCache(convId, userContent, assistantContent, sourceDocumentId) {
    if (!convId) return
    const now = new Date().toISOString()
    const existingMsgs = getLocalMessages(convId)
    const newMsgs = [
      ...existingMsgs,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: userContent,
        sourceDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
        createdAt: now,
      },
      {
        id: `asst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: assistantContent,
        sourceDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
        createdAt: now,
      },
    ]
    saveLocalMessages(convId, newMsgs)

    // Update conversation record
    const convs = getLocalConversations()
    const preview = stripMarkdown(assistantContent).slice(0, 140)
    const titleCandidate = userContent.replace(/\s+/g, ' ').trim().slice(0, 50)
    let found = false
    const updatedConvs = convs.map((c) => {
      if ((c._id || c.id) === convId) {
        found = true
        return {
          ...c,
          title: c.title && c.title !== 'New Consultation' ? c.title : titleCandidate,
          lastMessagePreview: preview,
          lastMessageAt: now,
          updatedAt: now,
        }
      }
      return c
    })

    if (!found) {
      updatedConvs.unshift({
        _id: convId,
        id: convId,
        title: titleCandidate || 'Health Consultation',
        sourceDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
        lastMessagePreview: preview,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    saveLocalConversations(updatedConvs)
  },

  async renameConversation(conversationId, title) {
    try {
      await apiClient.patch(`copilot/conversations/${conversationId}`, { title })
    } catch (err) {
      console.warn('[copilotApi] renameConversation backend warning:', err.message)
    }

    const convs = getLocalConversations().map((c) =>
      (c._id || c.id) === conversationId ? { ...c, title } : c
    )
    saveLocalConversations(convs)
    return { id: conversationId, title }
  },

  async deleteConversation(conversationId) {
    try {
      await apiClient.delete(`copilot/conversations/${conversationId}`)
    } catch (err) {
      console.warn('[copilotApi] deleteConversation backend warning:', err.message)
    }

    const convs = getLocalConversations().filter((c) => (c._id || c.id) !== conversationId)
    saveLocalConversations(convs)
    if (storageService.remove) {
      storageService.remove(`${MESSAGES_PREFIX}${conversationId}`)
    }
    return { deleted: true }
  },

  async getMemories() {
    try {
      const raw = await apiClient.get('copilot/memories')
      return Array.isArray(raw?.items) ? raw.items : []
    } catch (err) {
      console.warn('[copilotApi] getMemories warning:', err.message)
      return []
    }
  },

  async deleteMemory(memoryId) {
    try {
      await apiClient.delete(`copilot/memories/${memoryId}`)
      return true
    } catch (err) {
      console.warn('[copilotApi] deleteMemory warning:', err.message)
      return false
    }
  },
}
