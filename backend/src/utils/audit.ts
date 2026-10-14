import { getDb } from '../config/mongo';
import { AuditEventDoc } from '../types/models';

export async function auditLog(event: Omit<AuditEventDoc, '_id'>): Promise<void> {
  try {
    const db = getDb();
    await db.collection<AuditEventDoc>('audit_events').insertOne({
      ...event,
      occurredAt: new Date(),
    });
  } catch (err) {
    // Audit failures must not break the main flow — log only
    console.error('[audit] Failed to write audit event:', err);
  }
}
