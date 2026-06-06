export type MoodValue = "calm" | "anxious" | "fatigued";

export interface ReportSimulationDay {
  sleepHours: number | null;
  steps: number | null;
  heartRate: number | null;
  restingHR: number | null;
  workoutMinutes: number | null;
  weightKg?: number | null;
  mood: MoodValue | null;
  habitCompletions: number;
  creditsEarned: number;
  chatMessages: number;
  memoryNote: string | null;
}

export interface ReportSimulationScenario {
  name: string;
  description: string;
  day: ReportSimulationDay;
}

export const REPORT_SIMULATION_SCENARIOS: ReportSimulationScenario[] = [
  {
    name: "balanced",
    description: "基础健康日：睡眠、步数、轻运动、平稳情绪都有记录",
    day: {
      sleepHours: 7.4,
      steps: 8200,
      heartRate: 72,
      restingHR: 62,
      workoutMinutes: 28,
      weightKg: null,
      mood: "calm",
      habitCompletions: 2,
      creditsEarned: 12,
      chatMessages: 2,
      memoryNote: "今天状态比较稳定，按计划完成了基础活动。",
    },
  },
  {
    name: "sleep-low",
    description: "睡眠不足：睡眠少、步数少、疲惫情绪，适合测试睡眠下滑洞察",
    day: {
      sleepHours: 3.6,
      steps: 2600,
      heartRate: 82,
      restingHR: 70,
      workoutMinutes: 0,
      mood: "fatigued",
      habitCompletions: 0,
      creditsEarned: 4,
      chatMessages: 2,
      memoryNote: "昨晚睡得很少，白天明显有些疲惫。",
    },
  },
  {
    name: "active",
    description: "运动多：高步数、较长运动、平稳心率，适合测试运动亮点",
    day: {
      sleepHours: 7.1,
      steps: 14500,
      heartRate: 76,
      restingHR: 58,
      workoutMinutes: 55,
      mood: "calm",
      habitCompletions: 3,
      creditsEarned: 24,
      chatMessages: 1,
      memoryNote: "今天运动量很足，散步和训练都完成了。",
    },
  },
  {
    name: "stressed",
    description: "压力偏高：睡眠偏短、心率偏高、焦虑情绪",
    day: {
      sleepHours: 5.2,
      steps: 4300,
      heartRate: 92,
      restingHR: 76,
      workoutMinutes: 0,
      mood: "anxious",
      habitCompletions: 0,
      creditsEarned: 6,
      chatMessages: 3,
      memoryNote: "今天压力比较大，晚上需要更早停下来休息。",
    },
  },
  {
    name: "recovery",
    description: "恢复日：睡眠改善、轻活动、正向情绪",
    day: {
      sleepHours: 8.2,
      steps: 6800,
      heartRate: 68,
      restingHR: 57,
      workoutMinutes: 18,
      mood: "calm",
      habitCompletions: 2,
      creditsEarned: 16,
      chatMessages: 2,
      memoryNote: "今天有意识放慢节奏，睡眠和精神状态都有恢复。",
    },
  },
  {
    name: "quiet",
    description: "安静日：只写少量对话/记忆，不写核心健康指标",
    day: {
      sleepHours: null,
      steps: null,
      heartRate: null,
      restingHR: null,
      workoutMinutes: null,
      mood: null,
      habitCompletions: 0,
      creditsEarned: 2,
      chatMessages: 2,
      memoryNote: "今天只是简单记录了一下近况。",
    },
  },
];

export function getReportSimulationScenario(name: string): ReportSimulationScenario | undefined {
  return REPORT_SIMULATION_SCENARIOS.find((scenario) => scenario.name === name);
}

export function parseUtcDay(dateText: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error(`Invalid date "${dateText}". Expected YYYY-MM-DD.`);
  }
  return new Date(`${dateText}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function atUtcHour(day: Date, hour: number, minute = 0): Date {
  return new Date(Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
}

export function utcDateKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}
