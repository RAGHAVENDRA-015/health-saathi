import { ObjectId, Db } from 'mongodb';
import { getDb } from '../config/mongo';
import { getFirebaseAdmin } from '../config/firebase';
import { NotificationDoc, NotificationType, UserDoc } from '../types/models';

export interface SendNotificationOptions {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
}

export class NotificationService {
  private customDb: Db | null = null;
  public mockSender?: ((args: { tokens: string[]; options: SendNotificationOptions }) => Promise<any>) | null = null;

  setDb(db: any): void {
    this.customDb = db as Db;
  }

  private getDbInstance(): Db {
    return this.customDb || getDb();
  }

  /**
   * Register or update an FCM token for a user
   */
  async registerFcmToken(ownerId: string, token: string): Promise<void> {
    if (!token || typeof token !== 'string') return;
    const db = this.getDbInstance();
    await db.collection<UserDoc>('users').updateOne(
      { firebaseUid: ownerId },
      {
        $addToSet: { fcmTokens: token.trim() },
        $set: { updatedAt: new Date() },
      } as never,
      { upsert: false }
    );
  }

  /**
   * Send a push notification through FCM and record in database for in-app toast
   */
  async sendNotification(ownerId: string, options: SendNotificationOptions): Promise<NotificationDoc> {
    const db = this.getDbInstance();
    const now = new Date();

    const notifDoc: NotificationDoc = {
      ownerId,
      title: options.title,
      body: options.body,
      type: options.type,
      data: options.data || {},
      read: false,
      fcmSent: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    const insertResult = await db.collection<NotificationDoc>('notifications').insertOne(notifDoc);
    notifDoc._id = insertResult.insertedId;

    // Fetch user FCM tokens
    try {
      const user = await db.collection<UserDoc>('users').findOne({ firebaseUid: ownerId });
      const tokens = user?.fcmTokens?.filter(Boolean) || [];

      if (tokens.length > 0) {
        let response: { successCount: number; failureCount: number; responses: any[] } | null = null;

        if (this.mockSender) {
          response = await this.mockSender({ tokens, options });
        } else {
          try {
            const admin = getFirebaseAdmin();
            const messaging = admin.messaging();

            response = await messaging.sendEachForMulticast({
              tokens,
              notification: {
                title: options.title,
                body: options.body,
              },
              webpush: {
                notification: {
                  title: options.title,
                  body: options.body,
                  icon: '/images/ai-assistant.png',
                },
                fcmOptions: {
                  link: '/',
                },
              },
              data: {
                notificationId: notifDoc._id ? notifDoc._id.toHexString() : '',
                type: options.type,
                ...(options.data || {}),
              },
            }).catch((fcmNetworkErr: any) => {
              console.warn(`[FCM] Push network notice for ${ownerId}:`, fcmNetworkErr?.message || fcmNetworkErr);
              return null;
            });
          } catch (initErr) {
            console.warn(`[FCM] Messaging init notice for ${ownerId}:`, initErr);
          }
        }

        if (response) {
          console.log(`[FCM] 📲 Dispatched push notification to ${ownerId} (${response.successCount} sent, ${response.failureCount} failed)`);
          await db.collection<NotificationDoc>('notifications').updateOne(
            { _id: notifDoc._id },
            { $set: { fcmSent: response.successCount > 0, updatedAt: new Date() } }
          );

          // Remove invalid/expired tokens automatically
          if (response.failureCount > 0 && Array.isArray(response.responses)) {
            const expiredTokens: string[] = [];
            response.responses.forEach((resp: any, idx: number) => {
              if (!resp?.success && resp?.error?.code === 'messaging/registration-token-not-registered') {
                expiredTokens.push(tokens[idx]);
              }
            });
            if (expiredTokens.length > 0) {
              await db.collection('users').updateOne(
                { firebaseUid: ownerId },
                { $pull: { fcmTokens: { $in: expiredTokens } } as never }
              );
            }
          }
        }
      }
    } catch (fcmErr) {
      console.warn(`[notificationService] FCM dispatch warning for ${ownerId}:`, fcmErr);
    }

    return notifDoc;
  }

  /**
   * 1. Medicine Schedule Alerts: Daily alerts for morning/evening dosage schedules
   */
  async notifyMedicineSchedule(
    ownerId: string,
    medicine: { name: string; strength?: string; timing?: string }
  ): Promise<NotificationDoc> {
    const timingDesc = medicine.timing ? ` (${medicine.timing})` : '';
    const strengthDesc = medicine.strength ? ` - ${medicine.strength}` : '';
    return this.sendNotification(ownerId, {
      title: 'Medicine Schedule Alert',
      body: `Time for your dose: ${medicine.name}${strengthDesc}${timingDesc}.`,
      type: 'MEDICINE_SCHEDULE',
      data: {
        category: 'MEDICINE',
        medicineName: medicine.name,
        timing: medicine.timing || '',
      },
    });
  }

  /**
   * 2. Appointment Follow-ups: Reminders 24 hours and 1 hour before a doctor visit
   */
  async notifyAppointmentFollowUp(
    ownerId: string,
    appointment: { doctorName: string; time?: string; hoursAhead: number; specialty?: string }
  ): Promise<NotificationDoc> {
    const is24h = appointment.hoursAhead >= 24;
    const title = is24h ? 'Appointment Follow-up (24 Hours)' : 'Appointment Follow-up (1 Hour)';
    const body = is24h
      ? `Upcoming doctor visit with ${appointment.doctorName}${appointment.specialty ? ` (${appointment.specialty})` : ''} scheduled tomorrow${appointment.time ? ` at ${appointment.time}` : ''}.`
      : `Your consultation with ${appointment.doctorName} starts in 1 hour${appointment.time ? ` at ${appointment.time}` : ''}.`;

    return this.sendNotification(ownerId, {
      title,
      body,
      type: 'APPOINTMENT_REMINDER',
      data: {
        category: 'APPOINTMENT',
        doctorName: appointment.doctorName,
        hoursAhead: String(appointment.hoursAhead),
      },
    });
  }

  /**
   * 3. Lab Report Ready: Alerts when document OCR and AI analysis are completed
   */
  async notifyLabReportReady(
    ownerId: string,
    document: { id: string; name: string; findingsCount?: number }
  ): Promise<NotificationDoc> {
    const findingsMsg = document.findingsCount !== undefined && document.findingsCount > 0
      ? ` with ${document.findingsCount} extracted findings`
      : '';
    return this.sendNotification(ownerId, {
      title: 'Lab Report Ready',
      body: `Document OCR and AI analysis for "${document.name}" are complete${findingsMsg}. Clinical summary is ready.`,
      type: 'LAB_REPORT_READY',
      data: {
        category: 'DOCUMENT',
        documentId: document.id,
        documentName: document.name,
      },
    });
  }

  /**
   * Get notifications for a user (used by Foreground Web Listener / In-App Toasts)
   */
  async getUserNotifications(
    ownerId: string,
    options: { unreadOnly?: boolean; limit?: number; since?: Date } = {}
  ): Promise<{ items: NotificationDoc[]; unreadCount: number }> {
    const db = this.getDbInstance();
    const filter: Record<string, unknown> = {
      ownerId,
      deletedAt: null,
    };

    if (options.unreadOnly) {
      filter['read'] = false;
    }
    if (options.since) {
      filter['createdAt'] = { $gt: options.since };
    }

    const limit = Math.min(options.limit || 50, 100);

    const items = await db
      .collection<NotificationDoc>('notifications')
      .find(filter as never)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const unreadCount = await db
      .collection<NotificationDoc>('notifications')
      .countDocuments({ ownerId, read: false, deletedAt: null } as never);

    return { items, unreadCount };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(ownerId: string, notificationId: string): Promise<boolean> {
    if (!ObjectId.isValid(notificationId)) return false;
    const db = this.getDbInstance();
    const res = await db.collection<NotificationDoc>('notifications').updateOne(
      { _id: new ObjectId(notificationId), ownerId },
      { $set: { read: true, updatedAt: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(ownerId: string): Promise<number> {
    const db = this.getDbInstance();
    const res = await db.collection<NotificationDoc>('notifications').updateMany(
      { ownerId, read: false },
      { $set: { read: true, updatedAt: new Date() } }
    );
    return res.modifiedCount;
  }
}

let notificationServiceInstance: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
