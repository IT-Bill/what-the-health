/**
 * UserPersona — Alice Agent Loop four cognitive dimensions.
 * Each dimension stores an array of factual observations about the user.
 */

export interface PersonaIdentity {
  /** e.g. "software engineer", "parent of two", "night owl" */
  lifestyleTags: string[];
  /** Primary life role the user identifies with */
  role?: string;
  /** Key demographic facts: age group, location type, work schedule */
  demographics?: string[];
  /** Other identity markers */
  notes?: string[];
}

export interface PersonaBehavior {
  /** Daily/weekly routine patterns */
  routines: string[];
  /** Habit patterns observed over time */
  habitPatterns: string[];
  /** How the user copes with stress */
  stressCoping: string[];
  /** Behavioral triggers or patterns */
  triggers?: string[];
}

export interface PersonaExpression {
  /** Language preferences: formal/casual, emoji usage, verbosity */
  languageStyle: string[];
  /** Tone preferences the user responds to */
  tonePreferences: string[];
  /** Communication patterns */
  patterns?: string[];
}

export interface PersonaPreferences {
  /** How the user wants responses formatted */
  responseStyle: string[];
  /** Topics/areas the user wants focus on */
  focusAreas: string[];
  /** Things the user explicitly dislikes */
  avoid?: string[];
  /** Preferred interaction depth */
  depth?: string[];
}

export interface UserPersonaData {
  identity: PersonaIdentity;
  behavior: PersonaBehavior;
  expression: PersonaExpression;
  preferences: PersonaPreferences;
}

/** Default empty persona structure */
export function createEmptyPersona(): UserPersonaData {
  return {
    identity: { lifestyleTags: [] },
    behavior: { routines: [], habitPatterns: [], stressCoping: [] },
    expression: { languageStyle: [], tonePreferences: [] },
    preferences: { responseStyle: [], focusAreas: [] },
  };
}

/** Parse raw JSON from DB into typed persona */
export function parsePersona(raw: {
  identity: unknown;
  behavior: unknown;
  expression: unknown;
  preferences: unknown;
}): UserPersonaData {
  const empty = createEmptyPersona();
  return {
    identity: {
      lifestyleTags: extractStrings((raw.identity as Record<string, unknown>)?.lifestyleTags),
      role: stringOrUndef((raw.identity as Record<string, unknown>)?.role),
      demographics: extractStrings((raw.identity as Record<string, unknown>)?.demographics),
      notes: extractStrings((raw.identity as Record<string, unknown>)?.notes),
    },
    behavior: {
      routines: extractStrings((raw.behavior as Record<string, unknown>)?.routines),
      habitPatterns: extractStrings((raw.behavior as Record<string, unknown>)?.habitPatterns),
      stressCoping: extractStrings((raw.behavior as Record<string, unknown>)?.stressCoping),
      triggers: extractStrings((raw.behavior as Record<string, unknown>)?.triggers),
    },
    expression: {
      languageStyle: extractStrings((raw.expression as Record<string, unknown>)?.languageStyle),
      tonePreferences: extractStrings((raw.expression as Record<string, unknown>)?.tonePreferences),
      patterns: extractStrings((raw.expression as Record<string, unknown>)?.patterns),
    },
    preferences: {
      responseStyle: extractStrings((raw.preferences as Record<string, unknown>)?.responseStyle),
      focusAreas: extractStrings((raw.preferences as Record<string, unknown>)?.focusAreas),
      avoid: extractStrings((raw.preferences as Record<string, unknown>)?.avoid),
      depth: extractStrings((raw.preferences as Record<string, unknown>)?.depth),
    },
  };
}

function extractStrings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[];
  return [];
}

function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Flatten persona into a readable string for system prompt injection */
export function personaToSystemPromptText(persona: UserPersonaData): string {
  const lines: string[] = ["## 用户画像"];
  let hasContent = false;

  const id = persona.identity;
  if (id.lifestyleTags.length || id.role || id.demographics?.length || id.notes?.length) {
    hasContent = true;
    lines.push("\n### 你是谁");
    if (id.role) lines.push(`- 角色：${id.role}`);
    id.lifestyleTags.forEach((t) => lines.push(`- ${t}`));
    id.demographics?.forEach((d) => lines.push(`- ${d}`));
    id.notes?.forEach((n) => lines.push(`- ${n}`));
  }

  const bh = persona.behavior;
  if (bh.routines.length || bh.habitPatterns.length || bh.stressCoping.length || bh.triggers?.length) {
    hasContent = true;
    lines.push("\n### 你怎么做事");
    bh.routines.forEach((r) => lines.push(`- 日常：${r}`));
    bh.habitPatterns.forEach((h) => lines.push(`- 习惯：${h}`));
    bh.stressCoping.forEach((s) => lines.push(`- 应对压力：${s}`));
    bh.triggers?.forEach((t) => lines.push(`- 触发点：${t}`));
  }

  const ex = persona.expression;
  if (ex.languageStyle.length || ex.tonePreferences.length || ex.patterns?.length) {
    hasContent = true;
    lines.push("\n### 你怎么表达");
    ex.languageStyle.forEach((l) => lines.push(`- ${l}`));
    ex.tonePreferences.forEach((t) => lines.push(`- ${t}`));
    ex.patterns?.forEach((p) => lines.push(`- ${p}`));
  }

  const pr = persona.preferences;
  if (pr.responseStyle.length || pr.focusAreas.length || pr.avoid?.length || pr.depth?.length) {
    hasContent = true;
    lines.push("\n### 你希望我怎么做");
    pr.responseStyle.forEach((r) => lines.push(`- 回应风格：${r}`));
    pr.focusAreas.forEach((f) => lines.push(`- 关注重点：${f}`));
    pr.avoid?.forEach((a) => lines.push(`- 避免：${a}`));
    pr.depth?.forEach((d) => lines.push(`- 深度偏好：${d}`));
  }

  if (!hasContent) return "";
  return lines.join("\n");
}
