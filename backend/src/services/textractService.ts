/**
 * HealthSaathi AI - Amazon Textract Document Intelligence Service
 *
 * Implements Amazon Textract DetectDocumentText using AWS Signature Version 4 (SigV4)
 * with zero external dependencies (built on Node.js native crypto and https).
 *
 * Capabilities:
 * - Credentials & region discovery from environment / IAM config
 * - Synchronous document text detection (byte stream up to 5MB)
 * - Result normalization to match HealthSaathi OcrResponse schema
 * - Safe error classification (AccessDenied, UnsupportedDocument, Throttling, Limits)
 * - Safe fallback to local OCR (Tesseract + Pillow) when AWS is unconfigured
 */

import crypto from 'crypto';
import https from 'https';
import { getEnv } from '../config/env';
import { OcrResponse } from './ocrRunner';

export interface TextractConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  enabled: boolean;
}

export interface TextractBlock {
  BlockType: 'PAGE' | 'LINE' | 'WORD' | 'KEY_VALUE_SET' | 'TABLE' | 'CELL';
  Confidence?: number;
  Text?: string;
  Page?: number;
  Id?: string;
  Geometry?: unknown;
}

export interface TextractDetectResponse {
  DocumentMetadata?: {
    Pages: number;
  };
  Blocks?: TextractBlock[];
  DetectDocumentTextModelVersion?: string;
}

export class TextractError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TextractError';
    this.code = code;
  }
}

/**
 * Computes AWS Signature Version 4 (SigV4) Authorization header.
 */
function createAwsV4Signature(options: {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  body: string;
  headers: Record<string, string>;
  date: Date;
}): { authorization: string; amzDate: string; canonicalHeaders: Record<string, string> } {
  const amzDate = options.date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeadersMap: Record<string, string> = {
    ...options.headers,
    host: options.host,
    'x-amz-date': amzDate,
  };

  if (options.sessionToken) {
    canonicalHeadersMap['x-amz-security-token'] = options.sessionToken;
  }

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeadersStr = sortedHeaderKeys
    .map((k) => `${k.toLowerCase()}:${canonicalHeadersMap[k].trim()}\n`)
    .join('');
  const signedHeadersStr = sortedHeaderKeys.map((k) => k.toLowerCase()).join(';');

  const payloadHash = crypto.createHash('sha256').update(options.body).digest('hex');

  const canonicalRequest = [
    options.method,
    options.path,
    '', // query string
    canonicalHeadersStr,
    signedHeadersStr,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${options.region}/${options.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  function hmac(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  const kDate = hmac(`AWS4${options.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, options.region);
  const kService = hmac(kRegion, options.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return { authorization, amzDate, canonicalHeaders: canonicalHeadersMap };
}

export class TextractService {
  /**
   * Check whether Amazon Textract is configured with valid AWS credentials.
   */
  public static isConfigured(): boolean {
    const env = getEnv();
    return Boolean(
      env.ENABLE_AWS_TEXTRACT &&
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY &&
      env.AWS_REGION
    );
  }

  /**
   * Get current configuration status summary (safe to log; no credentials exposed).
   */
  public static getStatus(): { isConfigured: boolean; region: string; enabled: boolean; hasCredentials: boolean } {
    const env = getEnv();
    const hasCredentials = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
    return {
      isConfigured: this.isConfigured(),
      region: env.AWS_REGION,
      enabled: env.ENABLE_AWS_TEXTRACT,
      hasCredentials,
    };
  }

  /**
   * Synchronously detect document text from a raw Buffer using Amazon Textract DetectDocumentText API.
   * Document must be PNG, JPEG, or PDF under 5 MB (5,242,880 bytes).
   */
  public static async detectDocumentText(fileBuffer: Buffer): Promise<OcrResponse> {
    const startTime = Date.now();
    const env = getEnv();

    if (!this.isConfigured()) {
      throw new TextractError(
        'TEXTRACT_NOT_CONFIGURED',
        'Amazon Textract is not configured. AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing or ENABLE_AWS_TEXTRACT is false.'
      );
    }

    const MAX_TEXTRACT_BYTES = 5 * 1024 * 1024;
    if (fileBuffer.length > MAX_TEXTRACT_BYTES) {
      throw new TextractError(
        'FILE_TOO_LARGE',
        `Document size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds Amazon Textract synchronous limit of 5 MB.`
      );
    }

    const region = env.AWS_REGION;
    const host = `textract.${region}.amazonaws.com`;
    const path = '/';

    const payload = JSON.stringify({
      Document: {
        Bytes: fileBuffer.toString('base64'),
      },
    });

    const targetHeader = 'Textract.DetectDocumentText';
    const contentType = 'application/x-amz-json-1.1';

    const sigResult = createAwsV4Signature({
      method: 'POST',
      host,
      path,
      region,
      service: 'textract',
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: env.AWS_SESSION_TOKEN,
      body: payload,
      headers: {
        'content-type': contentType,
        'x-amz-target': targetHeader,
      },
      date: new Date(),
    });

    return new Promise<OcrResponse>((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          path,
          method: 'POST',
          headers: {
            ...sigResult.canonicalHeaders,
            Authorization: sigResult.authorization,
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 30000,
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(responseData);

              if (res.statusCode && res.statusCode >= 400) {
                const errorCode = parsed.__type || parsed.code || 'TEXTRACT_API_ERROR';
                const errorMessage = parsed.Message || parsed.message || 'Amazon Textract request failed';
                return reject(new TextractError(errorCode, `${errorCode}: ${errorMessage}`));
              }

              const normalized = TextractService.normalizeResponse(parsed as TextractDetectResponse, Date.now() - startTime);
              resolve(normalized);
            } catch (err: unknown) {
              const e = err as Error;
              reject(new TextractError('INVALID_RESPONSE', `Failed to parse Textract response: ${e.message}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new TextractError('TIMEOUT', 'Amazon Textract request timed out after 30s'));
      });

      req.on('error', (err) => {
        reject(new TextractError('NETWORK_ERROR', `Amazon Textract network error: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Normalizes Amazon Textract DetectDocumentText output into HealthSaathi OcrResponse.
   */
  public static normalizeResponse(data: TextractDetectResponse, durationMs: number = 0): OcrResponse {
    const blocks = data.Blocks || [];
    const lineBlocks = blocks.filter((b) => b.BlockType === 'LINE');
    const pageBlocks = blocks.filter((b) => b.BlockType === 'PAGE');

    const pageCount = data.DocumentMetadata?.Pages || Math.max(1, pageBlocks.length);
    const lineTexts = lineBlocks.map((b) => b.Text || '').filter(Boolean);
    const extractedText = lineTexts.join('\n');

    const confidences = lineBlocks
      .map((b) => b.Confidence)
      .filter((c): c is number => typeof c === 'number' && !isNaN(c));

    const avgConfidence = confidences.length > 0
      ? Number((confidences.reduce((acc, c) => acc + c, 0) / confidences.length).toFixed(2))
      : null;

    // Group lines by page (1-indexed)
    const pagesMap = new Map<number, string[]>();
    for (let i = 1; i <= pageCount; i++) {
      pagesMap.set(i, []);
    }

    for (const line of lineBlocks) {
      const pageNum = line.Page || 1;
      if (!pagesMap.has(pageNum)) {
        pagesMap.set(pageNum, []);
      }
      if (line.Text) {
        pagesMap.get(pageNum)!.push(line.Text);
      }
    }

    const pages = Array.from(pagesMap.entries()).map(([pageNum, lines]) => {
      const text = lines.join('\n');
      const words = text.split(/\s+/).filter(Boolean);
      return {
        pageNumber: pageNum,
        method: 'ocr' as const,
        text,
        charCount: text.length,
        wordCount: words.length,
        confidence: avgConfidence,
        success: true,
      };
    });

    const totalWords = extractedText.split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      documentType: pageCount > 1 ? 'pdf' : 'image',
      pageCount,
      extractedText,
      pages,
      metadata: {
        totalChars: extractedText.length,
        totalWords,
        ocrPagesCount: pageCount,
        embeddedPagesCount: 0,
        avgOcrConfidence: avgConfidence,
        processingDurationMs: durationMs,
      },
    };
  }
}
