import { createHash } from 'crypto';

/**
 * Cursor-based pagination helpers.
 * Cursors are base64-encoded ObjectId strings.
 */

export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + 'health-salt').digest('hex').slice(0, 16);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}
