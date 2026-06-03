/** Pure client-safe definition of alert rules — no Prisma dependency. */
export interface AlertRuleInfo {
  metric: string;
  metricLabel: string;
  condition: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
}

export const ALERT_RULE_INFO: AlertRuleInfo[] = [
  // ── Critical ─────────────────────────────────────────────────────────────
  {
    metric: "heartRate",
    metricLabel: "心率",
    condition: "> 120 或 < 45 bpm",
    severity: "critical",
    title: "心率严重异常",
    description: "心率超出安全范围，可能存在心律失常等风险，需立即关注。",
  },
  {
    metric: "bloodPressure",
    metricLabel: "收缩压",
    condition: "> 180 mmHg",
    severity: "critical",
    title: "血压危急",
    description: "属于高血压危象范围，有脑卒中、心肌梗死风险，建议立即就医。",
  },
  {
    metric: "diastolicBP",
    metricLabel: "舒张压",
    condition: "> 120 mmHg",
    severity: "critical",
    title: "舒张压危急",
    description: "舒张压极度升高，属于高血压危象，建议立即就医。",
  },
  {
    metric: "bloodOxygen",
    metricLabel: "血氧",
    condition: "< 90%",
    severity: "critical",
    title: "血氧过低",
    description: "血氧饱和度严重偏低，可能存在缺氧风险，请及时关注。",
  },

  // ── Warning ───────────────────────────────────────────────────────────────
  {
    metric: "heartRate",
    metricLabel: "心率",
    condition: "> 100 bpm",
    severity: "warning",
    title: "心率偏高",
    description: "静息心率持续偏高，建议关注是否存在贫血、甲亢或过度紧张等因素。",
  },
  {
    metric: "heartRate",
    metricLabel: "心率",
    condition: "< 50 bpm",
    severity: "warning",
    title: "心率偏低",
    description: "心率低于正常范围，可能由药物（如β受体阻滞剂）或心脏传导问题引起。",
  },
  {
    metric: "bloodPressure",
    metricLabel: "收缩压",
    condition: "> 160 mmHg",
    severity: "warning",
    title: "血压过高",
    description: "收缩压明显升高，建议立即休息，考虑就医或调整用药。",
  },
  {
    metric: "bloodPressure",
    metricLabel: "收缩压",
    condition: "> 140 mmHg",
    severity: "warning",
    title: "血压偏高",
    description: "高于正常范围，建议低盐饮食、避免剧烈活动，并持续监测。",
  },
  {
    metric: "diastolicBP",
    metricLabel: "舒张压",
    condition: "> 90 mmHg",
    severity: "warning",
    title: "舒张压偏高",
    description: "舒张压高于正常值（80 mmHg），是心血管疾病的独立风险因素，请注意休息。",
  },
  {
    metric: "bloodOxygen",
    metricLabel: "血氧",
    condition: "< 94%",
    severity: "warning",
    title: "血氧偏低",
    description: "血氧低于 95% 正常值，可能与睡眠呼吸暂停、肺部疾病等有关。",
  },
  {
    metric: "sleepAnalysis",
    metricLabel: "睡眠时长",
    condition: "< 4 小时",
    severity: "warning",
    title: "睡眠严重不足",
    description: "长期睡眠严重不足会增加心血管疾病、认知障碍风险，请关注睡眠质量。",
  },

  // ── Info ──────────────────────────────────────────────────────────────────
  {
    metric: "heartRate",
    metricLabel: "心率",
    condition: "> 90 bpm",
    severity: "info",
    title: "心率略高",
    description: "稍高于正常静息范围（60-90 bpm），注意休息状态下是否持续偏高。",
  },
  {
    metric: "bloodPressure",
    metricLabel: "收缩压",
    condition: "> 130 mmHg",
    severity: "info",
    title: "血压略高",
    description: "略高于理想范围（<130 mmHg），建议低盐饮食、适当运动、减少压力。",
  },
  {
    metric: "sleepAnalysis",
    metricLabel: "睡眠时长",
    condition: "< 6 小时",
    severity: "info",
    title: "睡眠不足",
    description: "低于建议睡眠时长（7-9 小时），长期不足会影响免疫力和心血管健康。",
  },
];

export const SEVERITY_META = {
  critical: { label: "严重", color: "text-error", bg: "bg-error/10", dot: "bg-error" },
  warning:  { label: "警告", color: "text-tertiary", bg: "bg-tertiary/10", dot: "bg-tertiary" },
  info:     { label: "提示", color: "text-on-surface-variant", bg: "bg-surface-variant/30", dot: "bg-outline" },
} as const;
