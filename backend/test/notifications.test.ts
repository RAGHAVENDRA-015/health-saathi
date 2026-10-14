import assert from 'assert';
import { ObjectId } from 'mongodb';
import { connectMongo, getDb } from '../src/config/mongo';
import { initFirebase } from '../src/config/firebase';
import { getNotificationService } from '../src/services/notificationService';
import { checkAndDispatchReminders } from '../src/workers/reminderWorker';
import { AppointmentDoc, UserDoc } from '../src/types/models';

class MockNotificationCollection<T extends { _id?: ObjectId }> {
  private docs: T[] = [];

  async insertOne(doc: T) {
    const copy = { ...doc, _id: doc._id || new ObjectId() };
    this.docs.push(copy);
    return { insertedId: copy._id };
  }

  async findOne(filter: Record<string, any>) {
    return this.docs.find((d) => this.matchesFilter(d, filter)) || null;
  }

  find(filter: Record<string, any>) {
    let result = this.docs.filter((d) => this.matchesFilter(d, filter));
    return {
      sort: () => ({
        limit: (n: number) => ({
          toArray: async () => result.slice(0, n),
        }),
        toArray: async () => [...result],
      }),
      toArray: async () => [...result],
    };
  }

  async countDocuments(filter: Record<string, any>) {
    return this.docs.filter((d) => this.matchesFilter(d, filter)).length;
  }

  async updateOne(filter: Record<string, any>, update: { $set?: Record<string, any>; $addToSet?: Record<string, any>; $pull?: Record<string, any> }) {
    const doc: any = this.docs.find((d) => this.matchesFilter(d, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$addToSet) {
      for (const [key, val] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(doc[key])) doc[key] = [];
        if (!doc[key].includes(val)) doc[key].push(val);
      }
    }
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter: Record<string, any>, update: { $set?: Record<string, any> }) {
    const matches: any[] = this.docs.filter((d) => this.matchesFilter(d, filter));
    matches.forEach((doc) => {
      if (update.$set) Object.assign(doc, update.$set);
    });
    return { matchedCount: matches.length, modifiedCount: matches.length };
  }

  async deleteMany(filter: Record<string, any>) {
    const initial = this.docs.length;
    this.docs = this.docs.filter((d) => !this.matchesFilter(d, filter));
    return { deletedCount: initial - this.docs.length };
  }

  async deleteOne(filter: Record<string, any>) {
    const idx = this.docs.findIndex((d) => this.matchesFilter(d, filter));
    if (idx >= 0) {
      this.docs.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  private matchesFilter(doc: any, filter: Record<string, any>): boolean {
    for (const [key, expected] of Object.entries(filter)) {
      if (expected === null) {
        if (doc[key] !== null && doc[key] !== undefined) return false;
        continue;
      }
      if (expected && typeof expected === 'object' && expected.$gte) {
        const docDate = doc[key] instanceof Date ? doc[key] : new Date(doc[key]);
        const expDate = expected.$gte instanceof Date ? expected.$gte : new Date(expected.$gte);
        if (docDate.getTime() < expDate.getTime()) return false;
        continue;
      }
      if (expected instanceof ObjectId) {
        if (!doc[key] || doc[key].toString() !== expected.toString()) return false;
        continue;
      }
      if (doc[key] instanceof ObjectId) {
        if (doc[key].toString() !== expected.toString()) return false;
        continue;
      }
      if (doc[key] !== expected) return false;
    }
    return true;
  }
}

class MockDb {
  private collections: Map<string, MockNotificationCollection<any>> = new Map();

  collection<T extends { _id?: ObjectId }>(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockNotificationCollection<T>());
    }
    return this.collections.get(name) as MockNotificationCollection<T>;
  }
}

export async function runNotificationTests(): Promise<void> {
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('🧪 Running FCM Notification & Reminder Integration Tests');
  console.log('────────────────────────────────────────────────────────────\n');

  try {
    initFirebase();
  } catch {}

  let db: any;
  try {
    await connectMongo();
    db = getDb();
  } catch {
    // If in offline test sandbox, use in-memory high-fidelity mock
    db = new MockDb();
  }

  const notifService = getNotificationService();
  notifService.setDb(db);
  const testUserId = `test-user-${Date.now()}`;

  const dispatchedPushNotifications: Array<{ tokens: string[]; options: any }> = [];
  notifService.mockSender = async ({ tokens, options }) => {
    dispatchedPushNotifications.push({ tokens, options });
    return {
      successCount: tokens.length,
      failureCount: 0,
      responses: tokens.map(() => ({ success: true })),
    };
  };

  // Seed test user
  await db.collection('users').insertOne({
    firebaseUid: testUserId,
    email: `${testUserId}@example.com`,
    preferences: { language: 'en', notifications: true, accessibility: { highContrast: false, fontSize: 'medium' } },
    consent: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  try {
    // ─── Test 1: Register FCM Token ──────────────────────────────────────────
    console.log('  1. Registering FCM Push Token for user...');
    const testToken = `fcm-token-sample-${Date.now()}`;
    await notifService.registerFcmToken(testUserId, testToken);

    const userAfterToken = await db.collection('users').findOne({ firebaseUid: testUserId });
    assert.ok(userAfterToken?.fcmTokens?.includes(testToken), 'User fcmTokens must include registered token');
    console.log('     ✅ FCM Token registered successfully');

    // ─── Test 2: Medicine Schedule Alert ─────────────────────────────────────
    console.log('  2. Dispatching Medicine Schedule Alert (Morning/Evening dose)...');
    const medNotif = await notifService.notifyMedicineSchedule(testUserId, {
      name: 'Metformin 500mg',
      strength: '500 mg',
      timing: 'Morning after breakfast',
    });

    assert.strictEqual(medNotif.type, 'MEDICINE_SCHEDULE');
    assert.strictEqual(medNotif.title, 'Medicine Schedule Alert');
    assert.ok(medNotif.body.includes('Metformin 500mg'));
    assert.strictEqual(medNotif.read, false);
    console.log('     ✅ Medicine Schedule Alert generated with dosage timing');

    // ─── Test 3: Appointment Follow-up (24 Hours and 1 Hour) ──────────────────
    console.log('  3. Dispatching Appointment Follow-up alerts (24h & 1h prior)...');
    const appt24h = await notifService.notifyAppointmentFollowUp(testUserId, {
      doctorName: 'Dr. Ananya Mehta',
      time: '10:30 AM',
      hoursAhead: 24,
      specialty: 'Cardiologist',
    });
    assert.strictEqual(appt24h.type, 'APPOINTMENT_REMINDER');
    assert.ok(appt24h.title.includes('24 Hours'));
    assert.ok(appt24h.body.includes('Dr. Ananya Mehta'));

    const appt1h = await notifService.notifyAppointmentFollowUp(testUserId, {
      doctorName: 'Dr. Ananya Mehta',
      time: '10:30 AM',
      hoursAhead: 1,
      specialty: 'Cardiologist',
    });
    assert.strictEqual(appt1h.type, 'APPOINTMENT_REMINDER');
    assert.ok(appt1h.title.includes('1 Hour'));
    assert.ok(appt1h.body.includes('starts in 1 hour'));
    console.log('     ✅ Appointment Follow-up alerts verified for 24h and 1h windows');

    // ─── Test 4: Lab Report Ready Alert ──────────────────────────────────────
    console.log('  4. Dispatching Lab Report Ready alert (OCR + AI Analysis complete)...');
    const docId = new ObjectId().toHexString();
    const labNotif = await notifService.notifyLabReportReady(testUserId, {
      id: docId,
      name: 'Complete Blood Count (CBC) Report.pdf',
      findingsCount: 5,
    });
    assert.strictEqual(labNotif.type, 'LAB_REPORT_READY');
    assert.strictEqual(labNotif.title, 'Lab Report Ready');
    assert.ok(labNotif.body.includes('Complete Blood Count'));
    assert.ok(labNotif.body.includes('5 extracted findings'));
    console.log('     ✅ Lab Report Ready notification verified with findings count');

    // ─── Test 5: In-App Query & Mark Read ────────────────────────────────────
    console.log('  5. Querying unread notifications for In-App Toast listener...');
    const unreadResult = await notifService.getUserNotifications(testUserId, { unreadOnly: true });
    assert.ok(unreadResult.unreadCount >= 4, 'Should have at least 4 unread notifications');
    assert.strictEqual(unreadResult.items.length >= 4, true);

    const markSuccess = await notifService.markAsRead(testUserId, labNotif._id!.toHexString());
    assert.strictEqual(markSuccess, true);

    const afterRead = await notifService.getUserNotifications(testUserId, { unreadOnly: true });
    assert.strictEqual(afterRead.unreadCount, unreadResult.unreadCount - 1);
    console.log('     ✅ In-App Toast query and mark-as-read verified');

    // ─── Test 6: Automated Reminder Scheduler ────────────────────────────────
    console.log('  6. Testing Automated Reminder & Follow-up Scheduler worker...');
    const now = new Date();
    // Insert an appointment scheduled in 23.5 hours
    const apptScheduledAt = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const apptInsert = await db.collection('appointments').insertOne({
      ownerId: testUserId,
      doctorName: 'Dr. Rajesh Sharma',
      scheduledAt: apptScheduledAt,
      timezone: 'Asia/Kolkata',
      visitType: 'IN_PERSON',
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });

    const dispatchResult = await checkAndDispatchReminders(db);
    assert.ok(dispatchResult.appointmentsCount >= 1, 'Scheduler must dispatch 24h follow-up');

    const updatedAppt = await db.collection('appointments').findOne({ _id: apptInsert.insertedId });
    assert.strictEqual(updatedAppt?.notified24h, true, 'Appointment must be marked notified24h');
    console.log('     ✅ Automated Reminder Worker successfully detected and dispatched follow-up');

    console.log('\n🎉 ALL FCM NOTIFICATION & REMINDER TESTS PASSED!\n');
  } finally {
    notifService.mockSender = null;
    // Cleanup test data
    await db.collection('notifications').deleteMany({ ownerId: testUserId });
    await db.collection('users').deleteOne({ firebaseUid: testUserId });
    await db.collection('appointments').deleteMany({ ownerId: testUserId });
  }
}
