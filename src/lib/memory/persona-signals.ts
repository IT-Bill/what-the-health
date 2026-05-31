import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createEmptyPersona, parsePersona, type UserPersonaData } from "@/lib/persona-types";

const MAX_SIGNAL_ITEMS = 30;

export interface PersonaSignals {
  focusAreas?: string[];
  preferenceSignals?: string[];
  behaviorSignals?: string[];
}

export function recordPersonaSignalsInBackground(userId: string, signals: PersonaSignals): void {
  recordPersonaSignals(userId, signals).catch((error) => {
    console.error("[Persona] Signal update failed:", error);
  });
}

export async function recordPersonaSignals(userId: string, signals: PersonaSignals): Promise<void> {
  const row = await prisma.userPersona.findUnique({ where: { userId } });
  const persona = row
    ? parsePersona({
        identity: row.identity,
        behavior: row.behavior,
        expression: row.expression,
        preferences: row.preferences,
      })
    : createEmptyPersona();

  const next = mergePersonaSignals(persona, signals);
  const data = {
    identity: next.identity as unknown as Prisma.InputJsonValue,
    behavior: next.behavior as unknown as Prisma.InputJsonValue,
    expression: next.expression as unknown as Prisma.InputJsonValue,
    preferences: next.preferences as unknown as Prisma.InputJsonValue,
  };

  if (row) {
    await prisma.userPersona.update({
      where: { userId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    return;
  }

  await prisma.userPersona.create({
    data: {
      userId,
      ...data,
    },
  });
}

export function mergePersonaSignals(
  persona: UserPersonaData,
  signals: PersonaSignals
): UserPersonaData {
  return {
    ...persona,
    behavior: {
      ...persona.behavior,
      habitPatterns: mergeStrings(persona.behavior.habitPatterns, signals.behaviorSignals ?? []),
    },
    preferences: {
      ...persona.preferences,
      focusAreas: mergeStrings(persona.preferences.focusAreas, signals.focusAreas ?? []),
      responseStyle: mergeStrings(persona.preferences.responseStyle, signals.preferenceSignals ?? []),
    },
  };
}

function mergeStrings(existing: string[], incoming: string[]): string[] {
  const result = [...existing];
  for (const item of incoming) {
    const value = item.trim();
    if (!value) continue;
    if (result.some((current) => current.trim().toLowerCase() === value.toLowerCase())) continue;
    result.push(value);
  }
  return result.slice(-MAX_SIGNAL_ITEMS);
}
