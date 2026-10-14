import { Db } from 'mongodb';
import { getDb } from '../config/mongo';
import { MedicineDoc, AppointmentDoc, ReminderDoc } from '../types/models';
import { getNotificationService } from '../services/notificationService';

const REMINDER_POLL_INTERVAL_MS = 60_000; // 1 minute

/**
 * Checks and dispatches:
 * 1. Medicine Schedule Alerts: Morning / evening alerts for active medications
 * 2. Appointment Follow-ups: 24-hour and 1-hour prior alerts for upcoming doctor visits
 * 3. Custom Scheduled Reminders: Timed alerts configured by user in Reminders page
 */
export async function checkAndDispatchReminders(customDb?: any): Promise<{ medicinesCount: number; appointmentsCount: number; remindersCount: number }> {
  const db: Db = (customDb as Db) || getDb();
  const now = new Date();
  const notifService = getNotificationService();
  if (customDb) notifService.setDb(customDb);

  let medicinesCount = 0;
  let appointmentsCount = 0;
  let remindersCount = 0;

  // ─── 1. Check Medicine Schedule Alerts ────────────────────────────────────────
  try {
    const activeMedicines = await db
      .collection<MedicineDoc>('medicines')
      .find({ status: 'ACTIVE', deletedAt: null } as never)
      .toArray();

    const currentHour = now.getHours(); // 0-23
    const isMorningSlot = currentHour >= 7 && currentHour <= 11;
    const isEveningSlot = currentHour >= 18 && currentHour <= 22;

    for (const med of activeMedicines) {
      const timingLower = (med.timing || '').toLowerCase();
      const freqLower = (med.frequency || '').toLowerCase();

      // Check if medicine matches current time slot
      const matchesMorning = isMorningSlot && (
        timingLower.includes('breakfast') ||
        timingLower.includes('morning') ||
        freqLower.includes('once') ||
        freqLower.includes('twice')
      );

      const matchesEvening = isEveningSlot && (
        timingLower.includes('dinner') ||
        timingLower.includes('evening') ||
        timingLower.includes('bedtime') ||
        freqLower.includes('twice')
      );

      if (matchesMorning || matchesEvening) {
        // Check if already notified in this slot today
        const lastNotified = med.lastNotifiedAt ? new Date(med.lastNotifiedAt) : null;
        const alreadyNotifiedSlot = lastNotified &&
          lastNotified.getFullYear() === now.getFullYear() &&
          lastNotified.getMonth() === now.getMonth() &&
          lastNotified.getDate() === now.getDate() &&
          ((isMorningSlot && lastNotified.getHours() >= 7 && lastNotified.getHours() <= 11) ||
           (isEveningSlot && lastNotified.getHours() >= 18 && lastNotified.getHours() <= 22));

        if (!alreadyNotifiedSlot) {
          await notifService.notifyMedicineSchedule(med.ownerId, {
            name: med.name,
            strength: med.strength,
            timing: med.timing,
          });

          await db.collection<MedicineDoc>('medicines').updateOne(
            { _id: med._id },
            { $set: { lastNotifiedAt: now, updatedAt: now } }
          );
          medicinesCount++;
        }
      }
    }
  } catch (medErr) {
    console.warn('[reminderWorker] Medicine schedule check error:', medErr);
  }

  // ─── 2. Check Appointment Follow-ups (24 Hours and 1 Hour) ────────────────────
  try {
    const upcomingAppointments = await db
      .collection<AppointmentDoc>('appointments')
      .find({
        status: 'SCHEDULED',
        scheduledAt: { $gte: now },
        deletedAt: null,
      } as never)
      .toArray();

    for (const appt of upcomingAppointments) {
      const scheduledTime = new Date(appt.scheduledAt).getTime();
      const diffMs = scheduledTime - now.getTime();
      const hoursRemaining = diffMs / (1000 * 60 * 60);

      const formattedTime = new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 24-hour reminder window: between 23 and 25 hours
      if (hoursRemaining >= 23 && hoursRemaining <= 25 && !appt.notified24h) {
        await notifService.notifyAppointmentFollowUp(appt.ownerId, {
          doctorName: appt.doctorName,
          time: formattedTime,
          hoursAhead: 24,
          specialty: appt.specialty,
        });

        await db.collection<AppointmentDoc>('appointments').updateOne(
          { _id: appt._id },
          { $set: { notified24h: true, updatedAt: now } }
        );
        appointmentsCount++;
      }

      // 1-hour reminder window: between 0 and 1.5 hours
      if (hoursRemaining >= 0 && hoursRemaining <= 1.5 && !appt.notified1h) {
        await notifService.notifyAppointmentFollowUp(appt.ownerId, {
          doctorName: appt.doctorName,
          time: formattedTime,
          hoursAhead: 1,
          specialty: appt.specialty,
        });

        await db.collection<AppointmentDoc>('appointments').updateOne(
          { _id: appt._id },
          { $set: { notified1h: true, updatedAt: now } }
        );
        appointmentsCount++;
      }
    }
  } catch (apptErr) {
    console.warn('[reminderWorker] Appointment follow-up check error:', apptErr);
  }

  // ─── 3. Check Custom Scheduled Reminders ──────────────────────────────────
  try {
    const activeReminders = await db
      .collection<ReminderDoc>('reminders')
      .find({
        enabled: true,
        deletedAt: null,
        completedAt: null,
      } as never)
      .toArray();

    for (const rem of activeReminders) {
      let isDue = false;
      const scheduledStr = (rem.scheduledAtLocal || '').trim();

      if (scheduledStr.includes('T') || scheduledStr.includes('-')) {
        // Full date+time (e.g. "2026-10-14T09:00" or ISO format)
        const scheduledDate = new Date(scheduledStr);
        if (!isNaN(scheduledDate.getTime())) {
          if (now.getTime() >= scheduledDate.getTime()) {
            isDue = true;
          }
        }
      } else if (/^\d{1,2}:\d{2}$/.test(scheduledStr)) {
        // Time only format, e.g. "09:00"
        const [targetHour, targetMinute] = scheduledStr.split(':').map(Number);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetMinutes = targetHour * 60 + targetMinute;
        const currentMinutes = currentHour * 60 + currentMinute;
        if (currentMinutes >= targetMinutes) {
          isDue = true;
        }
      }

      if (isDue) {
        // Prevent duplicate dispatch for same reminder slot / day
        const lastNotified = rem.lastNotifiedAt ? new Date(rem.lastNotifiedAt) : null;
        const alreadyNotifiedRecently = lastNotified && (now.getTime() - lastNotified.getTime() < 10 * 60 * 1000);
        const alreadyNotifiedToday = lastNotified &&
          lastNotified.getFullYear() === now.getFullYear() &&
          lastNotified.getMonth() === now.getMonth() &&
          lastNotified.getDate() === now.getDate();

        if (!alreadyNotifiedRecently && !alreadyNotifiedToday) {
          const notifType = rem.category === 'MEDICINE'
            ? 'MEDICINE_SCHEDULE'
            : rem.category === 'APPOINTMENT'
            ? 'APPOINTMENT_REMINDER'
            : 'GENERAL';

          console.log(`[reminderWorker] 🔔 Dispatching custom reminder "${rem.title}" (${rem._id}) to ${rem.ownerId}`);

          await notifService.sendNotification(rem.ownerId, {
            title: rem.title || 'Health Routine Reminder',
            body: rem.notes && rem.notes.trim().length > 0 ? `${rem.title}: ${rem.notes}` : `HealthSaathi Reminder: It's time for ${rem.title}.`,
            type: notifType,
            data: {
              reminderId: rem._id ? rem._id.toHexString() : '',
              category: rem.category,
              scheduledAtLocal: rem.scheduledAtLocal,
            },
          });

          const updatePayload: Record<string, unknown> = {
            lastNotifiedAt: now,
            updatedAt: now,
          };
          if (rem.repeat === 'ONCE') {
            updatePayload.completedAt = now;
          }

          await db.collection<ReminderDoc>('reminders').updateOne(
            { _id: rem._id },
            { $set: updatePayload }
          );
          remindersCount++;
        }
      }
    }
  } catch (remErr) {
    console.warn('[reminderWorker] Custom reminders check error:', remErr);
  }

  return { medicinesCount, appointmentsCount, remindersCount };
}

/**
 * Start the background reminder scheduler daemon
 */
export function startReminderScheduler(): void {
  console.log('[reminderWorker] ⏰ Starting HealthSaathi Reminder & Follow-up Scheduler...');

  let running = true;
  (async () => {
    while (running) {
      try {
        await checkAndDispatchReminders();
      } catch (err) {
        console.error('[reminderWorker] Scheduler error:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, REMINDER_POLL_INTERVAL_MS));
    }
  })().catch((err) => {
    console.error('[reminderWorker] Scheduler stopped unexpectedly:', err);
  });
}
