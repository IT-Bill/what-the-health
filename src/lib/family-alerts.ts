/**
 * Family health alert service.
 * Detects anomalies in health data and notifies family members.
 */
import { prisma } from "@/lib/prisma";

interface AnomalyRule {
  metric: string;
  condition: (value: number) => boolean;
  severity: "info" | "warning" | "critical";
  title: string;
  template: (value: number, unit: string) => string;
  minAlertLevel: "low" | "medium" | "high";
}

/**
 * Anomaly detection rules.
 * Each rule defines when a single health record value is concerning.
 */
const ANOMALY_RULES: AnomalyRule[] = [
  // Critical — always notify (all alert levels)
  {
    metric: "heartRate",
    condition: (v) => v > 120 || v < 45,
    severity: "critical",
    title: "心率严重异常",
    template: (v, u) => `检测到心率 ${v} ${u}，已超出安全范围。请尽快关注。`,
    minAlertLevel: "low",
  },
  {
    metric: "bloodPressure",
    condition: (v) => v > 160,
    severity: "critical",
    title: "血压过高",
    template: (v, u) => `收缩压达到 ${v} ${u}，建议立即休息并考虑就医。`,
    minAlertLevel: "low",
  },
  {
    metric: "bloodOxygen",
    condition: (v) => v < 90,
    severity: "critical",
    title: "血氧过低",
    template: (v, u) => `血氧饱和度仅 ${v}${u}，可能存在缺氧风险，请及时关注。`,
    minAlertLevel: "low",
  },

  // Warning — notify medium and above
  {
    metric: "heartRate",
    condition: (v) => v > 100,
    severity: "warning",
    title: "心率偏高",
    template: (v, u) => `心率持续偏高（${v} ${u}），建议注意休息。`,
    minAlertLevel: "medium",
  },
  {
    metric: "bloodPressure",
    condition: (v) => v > 140,
    severity: "warning",
    title: "血压偏高",
    template: (v, u) => `血压读数 ${v} ${u}，高于正常范围。`,
    minAlertLevel: "medium",
  },
  {
    metric: "bloodOxygen",
    condition: (v) => v < 94,
    severity: "warning",
    title: "血氧偏低",
    template: (v, u) => `血氧 ${v}${u}，低于正常值（95%+），请留意。`,
    minAlertLevel: "medium",
  },

  // Info — only notify high alert level
  {
    metric: "heartRate",
    condition: (v) => v > 90,
    severity: "info",
    title: "心率略高",
    template: (v, u) => `心率 ${v} ${u}，稍高于正常静息范围。`,
    minAlertLevel: "high",
  },
];

const ALERT_LEVEL_ORDER = { low: 0, medium: 1, high: 2 };

/**
 * Check a user's recent health records for anomalies.
 * Creates FamilyAlert and notifies caregivers if triggered.
 *
 * Call this after health data import or on a schedule.
 */
export async function checkHealthAnomalies(userId: string) {
  // Find all families this user belongs to with alerting enabled
  const memberships = await prisma.familyMember.findMany({
    where: { userId, shareAlerts: true },
    include: { family: { include: { members: true } } },
  });

  if (memberships.length === 0) return;

  // Get latest health records (last hour, to avoid re-alerting on old data)
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const records = await prisma.healthRecord.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  if (records.length === 0) return;

  for (const membership of memberships) {
    const userAlertLevel = membership.alertLevel;

    for (const record of records) {
      for (const rule of ANOMALY_RULES) {
        if (record.metric !== rule.metric) continue;
        if (!rule.condition(record.value)) continue;

        // Check if this alert level is sensitive enough
        if (ALERT_LEVEL_ORDER[userAlertLevel] < ALERT_LEVEL_ORDER[rule.minAlertLevel]) continue;

        // Avoid duplicate alerts (same type + source user within last 2 hours)
        const existingAlert = await prisma.familyAlert.findFirst({
          where: {
            familyId: membership.familyId,
            sourceUserId: userId,
            alertType: "health-anomaly",
            title: rule.title,
            createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          },
        });
        if (existingAlert) continue;

        // Create alert
        const alert = await prisma.familyAlert.create({
          data: {
            familyId: membership.familyId,
            sourceUserId: userId,
            alertType: "health-anomaly",
            severity: rule.severity,
            title: rule.title,
            content: rule.template(record.value, record.unit),
            metadata: {
              metric: record.metric,
              value: record.value,
              unit: record.unit,
              recordedAt: record.startDate.toISOString(),
            },
          },
        });

        // Notify all caregivers and owners in the family
        const caregivers = membership.family.members.filter(
          (m) => m.userId !== userId && (m.role === "owner" || m.role === "caregiver")
        );

        const sourceUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        for (const caregiver of caregivers) {
          await prisma.notification.create({
            data: {
              userId: caregiver.userId,
              title: `⚠️ ${membership.nickname || sourceUser?.name || "家人"} ${rule.title}`,
              body: rule.template(record.value, record.unit),
              source: "family-health-alert",
              actionUrl: `/discover/family/${membership.familyId}`,
              metadata: {
                alertId: alert.id,
                familyId: membership.familyId,
                sourceUserId: userId,
                severity: rule.severity,
              },
            },
          });
        }

        break; // One alert per metric per check cycle
      }
    }
  }
}

/**
 * Trigger a family alert from chat concern detection.
 * Called by the chat agent when it detects health concerns in conversation.
 */
export async function triggerChatConcernAlert(
  userId: string,
  concern: { title: string; content: string; severity: "info" | "warning" | "critical" }
) {
  const memberships = await prisma.familyMember.findMany({
    where: { userId, shareAlerts: true },
    include: { family: { include: { members: true } } },
  });

  if (memberships.length === 0) return;

  const sourceUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  for (const membership of memberships) {
    // Create alert
    const alert = await prisma.familyAlert.create({
      data: {
        familyId: membership.familyId,
        sourceUserId: userId,
        alertType: "chat-concern",
        severity: concern.severity,
        title: concern.title,
        content: concern.content,
      },
    });

    // Notify caregivers
    const caregivers = membership.family.members.filter(
      (m) => m.userId !== userId && (m.role === "owner" || m.role === "caregiver")
    );

    for (const caregiver of caregivers) {
      await prisma.notification.create({
        data: {
          userId: caregiver.userId,
          title: `🔔 ${membership.nickname || sourceUser?.name || "家人"}的健康关注`,
          body: concern.content,
          source: "family-chat-concern",
          actionUrl: `/discover/family/${membership.familyId}`,
          metadata: {
            alertId: alert.id,
            familyId: membership.familyId,
            sourceUserId: userId,
            severity: concern.severity,
          },
        },
      });
    }
  }
}
