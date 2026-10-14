/**
 * HealthSaathi AI - OCR Runner Service
 *
 * Spawns the modular Python OCR CLI subprocess using safe argument arrays.
 * Handles temporary file creation, execution timeouts, stdout/stderr isolation,
 * JSON validation with Zod, and guaranteed temp-file cleanup.
 */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { z } from 'zod';
import { getEnv } from '../config/env';

// ─── Result Schemas ───────────────────────────────────────────────────────────

export const OcrPageSchema = z.object({
  pageNumber: z.number(),
  method: z.enum(['embedded_text', 'ocr']),
  text: z.string(),
  charCount: z.number(),
  wordCount: z.number(),
  confidence: z.number().nullable().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

export type OcrPage = z.infer<typeof OcrPageSchema>;

export const OcrMetadataSchema = z.object({
  totalChars: z.number(),
  totalWords: z.number(),
  ocrPagesCount: z.number(),
  embeddedPagesCount: z.number(),
  avgOcrConfidence: z.number().nullable().optional(),
  processingDurationMs: z.number().optional(),
});

export type OcrMetadata = z.infer<typeof OcrMetadataSchema>;

export const OcrResponseSchema = z.object({
  success: z.boolean(),
  documentType: z.enum(['pdf', 'image']).optional(),
  pageCount: z.number().optional(),
  extractedText: z.string().optional(),
  pages: z.array(OcrPageSchema).optional(),
  metadata: OcrMetadataSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type OcrResponse = z.infer<typeof OcrResponseSchema>;

export class OcrRunnerError extends Error {
  public errorCode: string;
  constructor(errorCode: string, message: string) {
    super(message);
    this.name = 'OcrRunnerError';
    this.errorCode = errorCode;
  }
}

/**
 * Resolve the Python interpreter binary path.
 */
export function resolvePythonPath(): string {
  const env = getEnv();
  if (env.PYTHON_PATH) {
    // If it's relative, resolve relative to backend root
    const resolved = path.isAbsolute(env.PYTHON_PATH)
      ? env.PYTHON_PATH
      : path.resolve(__dirname, '../../', env.PYTHON_PATH);
    return resolved;
  }

  // Check backend/ocr/.venv/bin/python
  const localVenv = path.resolve(__dirname, '../../ocr/.venv/bin/python');
  return localVenv;
}

/**
 * Process a document buffer (PDF or Image) using the Python OCR component.
 */
export async function processDocumentWithOcr(
  fileBuffer: Buffer,
  mimeType: string,
  options?: {
    maxPages?: number;
    dpi?: number;
    lang?: string;
    timeoutMs?: number;
  }
): Promise<OcrResponse> {
  const env = getEnv();
  const maxPages = options?.maxPages ?? env.OCR_MAX_PAGES;
  const lang = options?.lang ?? env.TESSERACT_LANG;
  const timeoutMs = options?.timeoutMs ?? env.OCR_TIMEOUT_MS;
  const dpi = options?.dpi ?? 200;

  // Determine file extension
  let ext = '.bin';
  if (mimeType === 'application/pdf') ext = '.pdf';
  else if (mimeType === 'image/jpeg') ext = '.jpg';
  else if (mimeType === 'image/png') ext = '.png';

  // Secure temporary file
  const tempFilename = `healthsaathi_doc_${crypto.randomUUID()}${ext}`;
  const tempFilePath = path.join(os.tmpdir(), tempFilename);

  // Write file with restricted permissions (0o600: read/write by owner only)
  await fs.writeFile(tempFilePath, fileBuffer, { mode: 0o600 });

  const pythonBin = resolvePythonPath();
  const scriptPath = path.resolve(__dirname, '../../ocr/main.py');

  const args = [
    scriptPath,
    '--input', tempFilePath,
    '--mime-type', mimeType,
    '--max-pages', String(maxPages),
    '--lang', lang,
    '--dpi', String(dpi),
    '--timeout', String(Math.floor(timeoutMs / 1000)),
  ];

  const execEnv: NodeJS.ProcessEnv = {
    ...process.env,
  };
  if (env.TESSERACT_CMD) {
    execEnv.TESSERACT_CMD = env.TESSERACT_CMD;
  }
  if (!execEnv.PATH?.includes('/opt/homebrew/bin')) {
    execEnv.PATH = `/opt/homebrew/bin:${execEnv.PATH || ''}`;
  }

  try {
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        pythonBin,
        args,
        {
          env: execEnv,
          timeout: timeoutMs,
          maxBuffer: 20 * 1024 * 1024, // 20 MB buffer limit for large extractions
        },
        (error, stdout, stderr) => {
          if (error) {
            // Check for timeout kill
            if (error.killed) {
              return reject(new OcrRunnerError('OCR_TIMEOUT', `OCR process timed out after ${timeoutMs}ms`));
            }
            // If the python script exited with error code but produced JSON, we check stdout first
            if (stdout && stdout.trim()) {
              return resolve({ stdout, stderr });
            }
            return reject(
              new OcrRunnerError('PROCESS_FAILED', `OCR worker process failed: ${error.message}`)
            );
          }
          resolve({ stdout, stderr });
        }
      );
    });

    if (stderr && stderr.trim()) {
      // Diagnostic logging (strip any sensitive content, only log status indicators)
      const sanitizedLogs = stderr
        .split('\n')
        .filter((line) => line.startsWith('[') || line.includes('Warning') || line.includes('Error'))
        .slice(0, 10)
        .join('; ');
      if (sanitizedLogs) {
        console.log(`[ocrRunner] Diagnostics: ${sanitizedLogs}`);
      }
    }

    const trimmedStdout = stdout.trim();
    if (!trimmedStdout) {
      throw new OcrRunnerError('EMPTY_RESPONSE', 'OCR worker returned empty output');
    }

    // Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(trimmedStdout);
    } catch (parseErr) {
      throw new OcrRunnerError('INVALID_JSON', `Failed to parse JSON response from OCR worker`);
    }

    // Validate with Zod
    const validation = OcrResponseSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new OcrRunnerError(
        'SCHEMA_MISMATCH',
        `OCR worker response failed schema validation: ${validation.error.message}`
      );
    }

    const ocrData = validation.data;
    if (!ocrData.success) {
      throw new OcrRunnerError(
        ocrData.errorCode ?? 'EXTRACTION_FAILED',
        ocrData.errorMessage ?? 'Document processing failed'
      );
    }

    return ocrData;
  } finally {
    // Guaranteed temporary file cleanup
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // File might have already been cleaned up or not created
    }
  }
}
