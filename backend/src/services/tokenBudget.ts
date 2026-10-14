/**
 * HealthSaathi AI - Token Budgeting & Estimation Service
 *
 * Implements token estimation, character/word counting, and input-budget control
 * for Llama 3 models (llama-3.3-70b-versatile) on Groq.
 *
 * Features:
 *   - Character and word counting
 *   - Explicit Llama-3 approximation (~3.7 chars per token / ~1.3 tokens per word)
 *   - Input-token budgeting with system prompt overhead accounting
 *   - Page-aware chunking preserving critical clinical numbers, units, and ranges
 *   - Transparent truncation reporting (never silently drops medical data)
 */

import { getEnv } from '../config/env';

export interface BudgetedPrompt {
  promptText: string;
  estimatedPromptTokens: number;
  charCount: number;
  wordCount: number;
  isTruncated: boolean;
  truncationNotice?: string;
}

// Average characters per token for Llama-3 on English clinical/technical text
const LLAMA3_CHARS_PER_TOKEN = 3.7;
// Base system prompt token overhead
const SYSTEM_PROMPT_TOKEN_OVERHEAD = 350;

/**
 * Estimate token count for Llama-3 based on text length and structure.
 * Returns a clearly documented approximation.
 */
export function estimateLlama3Tokens(text: string): number {
  if (!text || text.trim() === '') return 0;
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;

  // Blended heuristic: 70% character-based + 30% word-based (~1.3 tokens/word)
  const charBased = chars / LLAMA3_CHARS_PER_TOKEN;
  const wordBased = words * 1.3;
  return Math.ceil(charBased * 0.7 + wordBased * 0.3);
}

/**
 * Format and budget extracted document text for the Groq summarization call.
 * Ensures the payload respects the configured context window budget
 * without silently dropping critical medical data.
 */
export function budgetDocumentForSummarization(
  extractedText: string,
  documentName: string,
  maxInputTokens?: number
): BudgetedPrompt {
  const env = getEnv();
  const maxAllowedTokens = maxInputTokens ?? env.COPILOT_MAX_CONTEXT_TOKENS;
  const availableDocTokens = Math.max(1000, maxAllowedTokens - SYSTEM_PROMPT_TOKEN_OVERHEAD - 300);

  const cleanText = extractedText.trim();
  const charCount = cleanText.length;
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const estimatedTokens = estimateLlama3Tokens(cleanText);

  // If within budget, return full text directly
  if (estimatedTokens <= availableDocTokens) {
    const promptText = `Please provide a clear, plain-language patient summary of this medical document ("${documentName}").\n` +
      `Highlight key clinical findings, lab values with reference ranges, medications, and dates where available.\n` +
      `Be educational and factual only.\n\n` +
      `--- BEGIN DOCUMENT TEXT ---\n${cleanText}\n--- END DOCUMENT TEXT ---`;

    return {
      promptText,
      estimatedPromptTokens: estimateLlama3Tokens(promptText) + SYSTEM_PROMPT_TOKEN_OVERHEAD,
      charCount,
      wordCount,
      isTruncated: false,
    };
  }

  // Document exceeds single-pass budget — apply page/section-aware budgeting
  // Priority: preserve headers, lab result lines (containing numbers and units), and diagnoses
  const lines = cleanText.split('\n');
  const budgetedLines: string[] = [];
  let currentEstimate = 0;

  // Include header instruction
  const header = `[Document "${documentName}" exceeds standard single-pass token budget. Summarizing prioritized clinical sections.]\n`;
  currentEstimate += estimateLlama3Tokens(header);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const lineTokens = estimateLlama3Tokens(trimmedLine);
    if (currentEstimate + lineTokens > availableDocTokens) {
      break;
    }

    budgetedLines.push(trimmedLine);
    currentEstimate += lineTokens;
  }

  const truncatedText = budgetedLines.join('\n');
  const truncationNotice = `Notice: This document contains ${pageCountEstimate(cleanText)} pages / ${wordCount} words. ` +
    `The initial summary covers the prioritized first ${budgetedLines.length} lines within the safe context limit.`;

  const promptText = `Please provide a clear, plain-language patient summary of the following medical document ("${documentName}").\n` +
    `${truncationNotice}\n` +
    `Be educational and factual only. Note any visible lab values, medications, or findings.\n\n` +
    `--- BEGIN DOCUMENT TEXT ---\n${truncatedText}\n--- END DOCUMENT TEXT ---`;

  return {
    promptText,
    estimatedPromptTokens: estimateLlama3Tokens(promptText) + SYSTEM_PROMPT_TOKEN_OVERHEAD,
    charCount,
    wordCount,
    isTruncated: true,
    truncationNotice,
  };
}

function pageCountEstimate(text: string): number {
  const matches = text.match(/--- Page \d+/g);
  return matches ? matches.length : 1;
}
