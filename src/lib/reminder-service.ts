import { prisma } from "./prisma";
import { generateReminderMessage } from "./reminder-agent";

function getTodayDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

function getNextReminderTime(reminderTimes: string[]): Date | null {
  const now = new Date();
  const todayStr = getTodayDateStr(now);

  for (const t of reminderTimes) {
    const { hour, minute } = parseTime(t);
    const candidate = new Date(`${todayStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
    if (candidate > now) {
      return candidate;
    }
  }
  return null;
}

function isReminderDue(reminder: {
  reminderTimes: string[];
  lastRemindedAt: Date | null;
}): boolean {
  const now = new Date();
  const todayStr = getTodayDateStr(now);

  // If already reminded today, skip
  if (reminder.lastRemindedAt) {
    const lastDateStr = getTodayDateStr(reminder.lastRemindedAt);
    if (lastDateStr === todayStr) {
      return false;
    }
  }

  // Check if any reminder time has passed today
  for (const t of reminder.reminderTimes) {
    const { hour, minute } = parseTime(t);
    const reminderTime = new Date(`${todayStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
    if (now >= reminderTime) {
      return true;
    }
  }

  return false;
}

export async function checkAndSendReminders(): Promise<{
  checked: number;
  sent: number;
  errors: number;
}> {
  const activeReminders = await prisma.medicationReminder.findMany({
    where: {
      isActive: true,
      startDate: { lte: new Date() },
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  let sent = 0;
  let errors = 0;

  for (const reminder of activeReminders) {
    try {
      if (!isReminderDue(reminder)) {
        continue;
      }

      // Generate personalized message via Agent
      const { title, body } = await generateReminderMessage({
        userId: reminder.userId,
        userName: reminder.user.name || "",
        reminderType: inferReminderType(reminder.title),
        title: reminder.title,
        description: reminder.description,
        frequency: reminder.frequency,
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: reminder.userId,
          title,
          body,
          source: "reminder",
          priority: "urgent",
        },
      });

      // Update last reminded time
      await prisma.medicationReminder.update({
        where: { id: reminder.id },
        data: { lastRemindedAt: new Date() },
      });

      sent++;
    } catch (err) {
      console.error(`[ReminderService] Failed to process reminder ${reminder.id}:`, err);
      errors++;
    }
  }

  return { checked: activeReminders.length, sent, errors };
}

function inferReminderType(title: string): "medication" | "vital_sign" | "follow_up" | "check_in" {
  const t = title.toLowerCase();
  if (t.includes("药") || t.includes("药丸") || t.includes("服用")) return "medication";
  if (t.includes("血压") || t.includes("血糖") || t.includes("体温") || t.includes("测量")) return "vital_sign";
  if (t.includes("复诊") || t.includes("复查") || t.includes("预约")) return "follow_up";
  return "check_in";
}
