import {
  ACTIVITY_GOAL_IDS,
  BODY_COMPOSITION_GOAL_IDS,
  getPrimaryGoalLabels,
  hasPrimaryGoalGroup,
  requiresPrimaryGoalParameters,
} from "@/lib/primary-goals";

export type GoalParameterField =
  | "targetWeightKg"
  | "targetBodyFatPct"
  | "dailyActiveCalories"
  | "dailyExerciseMinutes"
  | "dailyStepGoal"
  | "dailyActiveHours";

export type GoalParameterPrerequisiteField = "heightCm" | "weightKg";

export interface GoalParameterUserProfile {
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  targetBodyFatPct?: number | null;
  dailyActiveCalories?: number | null;
  dailyExerciseMinutes?: number | null;
  dailyStepGoal?: number | null;
  dailyActiveHours?: number | null;
  primaryGoal?: string | null;
  primaryGoals?: readonly string[] | null;
}

export interface GoalParameterQuestion {
  field: GoalParameterPrerequisiteField;
  label: string;
  unit: string;
  prompt: string;
}

export interface GoalParameterRecommendation {
  field: GoalParameterField;
  label: string;
  unit: string;
  value: number;
  reason: string;
}

export interface GoalParameterSetupState {
  primaryGoalLabels: string[];
  requiresParameters: boolean;
  activeParameterFields: GoalParameterField[];
  missingPrerequisiteFields: GoalParameterPrerequisiteField[];
  prerequisiteQuestions: GoalParameterQuestion[];
  missingParameterFields: GoalParameterField[];
  lockedUntilBasicsComplete: boolean;
  recommendationsReady: boolean;
  recommendations: GoalParameterRecommendation[];
}

const FIELD_LABELS: Record<GoalParameterField, string> = {
  targetWeightKg: "目标体重",
  targetBodyFatPct: "目标体脂",
  dailyActiveCalories: "活动热量",
  dailyExerciseMinutes: "每日运动时间",
  dailyStepGoal: "每日步数",
  dailyActiveHours: "每日活动小时数",
};

const FIELD_UNITS: Record<GoalParameterField, string> = {
  targetWeightKg: "kg",
  targetBodyFatPct: "%",
  dailyActiveCalories: "kcal",
  dailyExerciseMinutes: "min",
  dailyStepGoal: "步",
  dailyActiveHours: "h",
};

const PREREQUISITE_QUESTIONS: Record<GoalParameterPrerequisiteField, GoalParameterQuestion> = {
  heightCm: {
    field: "heightCm",
    label: "身高",
    unit: "cm",
    prompt: "先告诉我你的身高，单位用 cm 就可以。",
  },
  weightKg: {
    field: "weightKg",
    label: "体重",
    unit: "kg",
    prompt: "再告诉我你现在的体重，单位用 kg。",
  },
};

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickBodyFatTarget(gender: string | null | undefined, mode: "lose" | "build" | "recompose"): number {
  if (gender === "female") {
    if (mode === "lose") return 26;
    if (mode === "build") return 23;
    return 24;
  }

  if (gender === "male") {
    if (mode === "lose") return 18;
    if (mode === "build") return 15;
    return 16;
  }

  if (mode === "lose") return 22;
  if (mode === "build") return 19;
  return 20;
}

function getActiveParameterFields(profile: GoalParameterUserProfile): GoalParameterField[] {
  const fields: GoalParameterField[] = [];

  if (hasPrimaryGoalGroup(profile.primaryGoals, profile.primaryGoal, BODY_COMPOSITION_GOAL_IDS)) {
    fields.push("targetWeightKg", "targetBodyFatPct");
  }

  if (hasPrimaryGoalGroup(profile.primaryGoals, profile.primaryGoal, ACTIVITY_GOAL_IDS)) {
    fields.push(
      "dailyActiveCalories",
      "dailyExerciseMinutes",
      "dailyStepGoal",
      "dailyActiveHours",
    );
  }

  return fields;
}

export function buildGoalParameterRecommendations(
  profile: GoalParameterUserProfile,
): GoalParameterRecommendation[] {
  if (!isPositiveNumber(profile.heightCm) || !isPositiveNumber(profile.weightKg)) {
    return [];
  }

  const wantsBodyComposition = hasPrimaryGoalGroup(
    profile.primaryGoals,
    profile.primaryGoal,
    BODY_COMPOSITION_GOAL_IDS,
  );
  const wantsActivity = hasPrimaryGoalGroup(
    profile.primaryGoals,
    profile.primaryGoal,
    ACTIVITY_GOAL_IDS,
  );

  if (!wantsBodyComposition && !wantsActivity) {
    return [];
  }

  const wantsLoseWeight = hasPrimaryGoalGroup(
    profile.primaryGoals,
    profile.primaryGoal,
    ["loseWeight"],
  );
  const wantsBuildMuscle = hasPrimaryGoalGroup(
    profile.primaryGoals,
    profile.primaryGoal,
    ["buildMuscle"],
  );
  const wantsDailyMovement = hasPrimaryGoalGroup(
    profile.primaryGoals,
    profile.primaryGoal,
    ["dailyMovement"],
  );

  const heightM = profile.heightCm / 100;
  const bmi = profile.weightKg / (heightM * heightM);
  const healthyMidWeight = 22 * heightM * heightM;
  const healthyStrongWeight = 23 * heightM * heightM;
  const recommendations: GoalParameterRecommendation[] = [];

  if (wantsBodyComposition) {
    let targetWeightKg = profile.weightKg;
    let targetBodyFatPct = pickBodyFatTarget(profile.gender, "recompose");
    let reason = "基于你当前的身高、体重和目标，先给你一版温和可执行的体态建议。";

    if (wantsLoseWeight && wantsBuildMuscle) {
      if (bmi > 24) {
        targetWeightKg = Math.min(
          profile.weightKg - 0.5,
          Math.max(healthyMidWeight, profile.weightKg * 0.95),
        );
      } else if (bmi < 21) {
        targetWeightKg = Math.max(profile.weightKg + 0.5, Math.min(healthyStrongWeight, profile.weightKg * 1.03));
      }
      targetBodyFatPct = pickBodyFatTarget(profile.gender, "recompose");
      reason = "你同时关注减重和塑形，推荐先以体态重组为主，目标更温和。";
    } else if (wantsLoseWeight) {
      if (bmi > 21.5) {
        targetWeightKg = Math.min(
          profile.weightKg - 0.5,
          Math.max(healthyMidWeight, profile.weightKg * 0.92),
        );
      }
      targetBodyFatPct = pickBodyFatTarget(profile.gender, "lose");
      reason = "以减重管理为主时，先设一个温和下降的目标体重与体脂会更容易坚持。";
    } else if (wantsBuildMuscle) {
      if (bmi < 25) {
        targetWeightKg = Math.max(
          profile.weightKg + 0.5,
          Math.min(healthyStrongWeight, profile.weightKg * 1.05),
        );
      }
      targetBodyFatPct = pickBodyFatTarget(profile.gender, "build");
      reason = "以增肌塑形为主时，先给身体留一点增长空间，同时把体脂目标控制在易执行区间。";
    }

    recommendations.push(
      {
        field: "targetWeightKg",
        label: FIELD_LABELS.targetWeightKg,
        unit: FIELD_UNITS.targetWeightKg,
        value: roundToStep(targetWeightKg, 0.5),
        reason,
      },
      {
        field: "targetBodyFatPct",
        label: FIELD_LABELS.targetBodyFatPct,
        unit: FIELD_UNITS.targetBodyFatPct,
        value: targetBodyFatPct,
        reason,
      },
    );
  }

  if (wantsActivity) {
    let dailyActiveCalories = clamp(roundToStep(profile.weightKg * (wantsDailyMovement ? 5 : 4.5), 25), 250, 650);
    let dailyExerciseMinutes = wantsDailyMovement ? 45 : 30;
    let dailyStepGoal = wantsDailyMovement ? 9000 : 7500;
    let dailyActiveHours = wantsDailyMovement ? 2 : 1.5;
    let reason = "结合你的体重和活动目标，先给你一组日常活动的推荐起点。";

    if (wantsLoseWeight) {
      dailyActiveCalories = clamp(dailyActiveCalories + 50, 250, 700);
      dailyExerciseMinutes += 10;
      dailyStepGoal += 1000;
      dailyActiveHours += 0.5;
      reason = "因为你有减重目标，活动量会略高一些，但仍然保持在可持续区间。";
    }

    if (wantsBuildMuscle) {
      dailyExerciseMinutes = Math.max(dailyExerciseMinutes, 45);
      dailyActiveHours = Math.max(dailyActiveHours, 2);
      reason = wantsLoseWeight
        ? "你同时关注体态和活动，推荐值会兼顾热量消耗与力量训练恢复。"
        : "因为你有塑形目标，推荐会把规律训练时间一起纳入。";
    }

    recommendations.push(
      {
        field: "dailyActiveCalories",
        label: FIELD_LABELS.dailyActiveCalories,
        unit: FIELD_UNITS.dailyActiveCalories,
        value: dailyActiveCalories,
        reason,
      },
      {
        field: "dailyExerciseMinutes",
        label: FIELD_LABELS.dailyExerciseMinutes,
        unit: FIELD_UNITS.dailyExerciseMinutes,
        value: dailyExerciseMinutes,
        reason,
      },
      {
        field: "dailyStepGoal",
        label: FIELD_LABELS.dailyStepGoal,
        unit: FIELD_UNITS.dailyStepGoal,
        value: clamp(roundToStep(dailyStepGoal, 500), 6000, 12000),
        reason,
      },
      {
        field: "dailyActiveHours",
        label: FIELD_LABELS.dailyActiveHours,
        unit: FIELD_UNITS.dailyActiveHours,
        value: roundToStep(clamp(dailyActiveHours, 1, 3), 0.5),
        reason,
      },
    );
  }

  return recommendations;
}

export function buildGoalParameterSetupState(
  profile: GoalParameterUserProfile,
): GoalParameterSetupState {
  const primaryGoalLabels = getPrimaryGoalLabels(profile.primaryGoals, profile.primaryGoal);
  const requiresParameters = requiresPrimaryGoalParameters(profile.primaryGoals, profile.primaryGoal);
  const activeParameterFields = getActiveParameterFields(profile);
  const missingPrerequisiteFields: GoalParameterPrerequisiteField[] = [];

  if (requiresParameters && activeParameterFields.length > 0) {
    if (!isPositiveNumber(profile.heightCm)) {
      missingPrerequisiteFields.push("heightCm");
    }
    if (!isPositiveNumber(profile.weightKg)) {
      missingPrerequisiteFields.push("weightKg");
    }
  }

  const prerequisiteQuestions = missingPrerequisiteFields.map(
    (field) => PREREQUISITE_QUESTIONS[field],
  );
  const missingParameterFields = activeParameterFields.filter(
    (field) => !isPositiveNumber(profile[field]),
  );
  const recommendationsReady = requiresParameters && activeParameterFields.length > 0 && missingPrerequisiteFields.length === 0;

  return {
    primaryGoalLabels,
    requiresParameters,
    activeParameterFields,
    missingPrerequisiteFields,
    prerequisiteQuestions,
    missingParameterFields,
    lockedUntilBasicsComplete: requiresParameters && missingPrerequisiteFields.length > 0,
    recommendationsReady,
    recommendations: recommendationsReady
      ? buildGoalParameterRecommendations(profile)
      : [],
  };
}

export function buildGoalParameterChatWelcome(
  profile: GoalParameterUserProfile,
): string | null {
  const setup = buildGoalParameterSetupState(profile);

  if (!setup.requiresParameters || setup.activeParameterFields.length === 0) {
    return null;
  }

  if (setup.missingPrerequisiteFields.length > 0) {
    return "开始之前，让我多了解你。先告诉我你的身高和当前体重吧。";
  }

  if (setup.missingParameterFields.length > 0) {
    return "我已经拿到你的基础信息了。如果你愿意，我现在可以帮你把目标参数先设成一版推荐值。直接回复“开始设置目标参数”就行。";
  }

  return null;
}