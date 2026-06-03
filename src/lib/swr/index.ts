"use client";

import useSWR, { mutate } from "swr";
import type { SWRConfiguration } from "swr";
import { swrFetcher } from "@/lib/swr-config";
import type { NotificationItem } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Types (mirror what the APIs return)
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email?: string;
  username?: string;
  name?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  agentRole?: string | null;
  birthday?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  targetBodyFatPct?: number | null;
  dailyActiveCalories?: number | null;
  dailyExerciseMinutes?: number | null;
  dailyStepGoal?: number | null;
  dailyActiveHours?: number | null;
  primaryGoal?: string | null;
  primaryGoals?: string[] | null;
  memberSince?: string | null;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  updatedAt: string;
  lastMessage: string | null;
}

export interface ChatMessageItem {
  id: string;
  role: string;
  content: string;
  imageUrl?: string;
  reasoning?: string;
  toolCallsJson?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const defaultOpts: SWRConfiguration = { fetcher: swrFetcher };

export function useUser() {
  return useSWR<{ user: User }>("/api/me", defaultOpts);
}

export function useSessions() {
  return useSWR<{ sessions: ChatSessionItem[] }>("/api/chat/sessions", defaultOpts);
}

export function useSessionMessages(sessionId?: string) {
  return useSWR<{ session: { id: string; title: string; messages: ChatMessageItem[] } }>(
    sessionId ? `/api/chat/sessions/${sessionId}/messages` : null,
    defaultOpts
  );
}

export function useNotifications(opts?: { refreshInterval?: number }) {
  return useSWR<{ notifications: NotificationItem[] }>(
    "/api/notifications",
    { ...defaultOpts, refreshInterval: opts?.refreshInterval ?? 0 }
  );
}

// ---------------------------------------------------------------------------
// Mutations (call after create/update/delete to revalidate)
// ---------------------------------------------------------------------------

export function refreshUser() {
  return mutate("/api/me");
}

export function refreshSessions() {
  return mutate("/api/chat/sessions");
}

export function refreshSessionMessages(sessionId: string) {
  return mutate(`/api/chat/sessions/${sessionId}/messages`);
}

export function refreshNotifications() {
  return mutate("/api/notifications");
}

export { mutate };
