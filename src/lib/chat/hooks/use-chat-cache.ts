"use client";

import { useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/chat/store";
import type { Message } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CHAT_SESSION_LIST_CACHE_KEY = "wth:chat-session-list-cache";
const CHAT_SESSION_MESSAGES_PREFIX = "wth:chat-session-messages:";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedSessionMessages {
  messages: Message[];
  savedAt: number;
}

interface CachedSessionList {
  sessions: Array<{
    id: string;
    title: string;
    messageCount: number;
    updatedAt: string;
    lastMessage: string | null;
    pinned: boolean;
  }>;
  savedAt: number;
}

interface CachedChatSessionPayload {
  sessionId?: string;
  messages: Message[];
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCacheExpired(savedAt: number): boolean {
  return Date.now() - savedAt > CHAT_CACHE_TTL_MS;
}

function normalizeCachedMessages(messages: Message[]): Message[] {
  return messages
    .filter((message) => message.id !== "init")
    .map((message) => ({ ...message, isStreaming: false }));
}

function coerceCachedMessage(value: unknown): Message | null {
  if (!value || typeof value !== "object") return null;

  const message = value as Partial<Message>;
  if (message.role !== "user" && message.role !== "agent") return null;
  if (typeof message.id !== "string" || typeof message.content !== "string") {
    return null;
  }

  return {
    ...message,
    id: message.id,
    role: message.role,
    content: message.content,
    imageUrl: typeof message.imageUrl === "string" ? message.imageUrl : undefined,
    isStreaming: false,
  };
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function getCachedSessionMessages(sessionId: string): CachedSessionMessages | null {
  try {
    const raw = localStorage.getItem(`${CHAT_SESSION_MESSAGES_PREFIX}${sessionId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedSessionMessages;
    if (!Array.isArray(data.messages)) return null;
    return {
      messages: data.messages.map(coerceCachedMessage).filter((m): m is Message => m !== null),
      savedAt: typeof data.savedAt === "number" ? data.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function setCachedSessionMessages(sessionId: string, messages: Message[]) {
  try {
    const normalized = normalizeCachedMessages(messages);
    if (normalized.length === 0) return;
    const data: CachedSessionMessages = { messages: normalized, savedAt: Date.now() };
    localStorage.setItem(`${CHAT_SESSION_MESSAGES_PREFIX}${sessionId}`, JSON.stringify(data));
  } catch {
    // localStorage full or disabled
  }
}

function clearCachedSessionMessages(sessionId: string) {
  try {
    localStorage.removeItem(`${CHAT_SESSION_MESSAGES_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function getCachedSessionList(): CachedSessionList | null {
  try {
    const raw = localStorage.getItem(CHAT_SESSION_LIST_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedSessionList;
    if (!Array.isArray(data.sessions)) return null;
    return {
      sessions: data.sessions,
      savedAt: typeof data.savedAt === "number" ? data.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function setCachedSessionList(sessions: CachedSessionList["sessions"]) {
  try {
    const data: CachedSessionList = { sessions, savedAt: Date.now() };
    localStorage.setItem(CHAT_SESSION_LIST_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or disabled
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatCache() {
  const writeCache = useCallback(() => {
    if (typeof window === "undefined") return;

    const state = useChatStore.getState();
    if (state.isStreaming) return;

    const sid = state.sessionId;
    const cachedMessages = normalizeCachedMessages(state.messages);
    if (cachedMessages.length === 0) return;

    if (sid) {
      setCachedSessionMessages(sid, cachedMessages);
    }

    // Also keep backward-compatible sessionStorage cache for fallback
    const payload: CachedChatSessionPayload = {
      sessionId: sid,
      messages: cachedMessages,
      savedAt: Date.now(),
    };
    sessionStorage.setItem("wth:chat-cached-session", JSON.stringify(payload));
  }, []);

  const readCache = useCallback(
    (sid?: string): CachedChatSessionPayload | null => {
      // Try localStorage first (new per-session cache)
      if (sid) {
        const cached = getCachedSessionMessages(sid);
        if (cached && cached.messages.length > 0) {
          return {
            sessionId: sid,
            messages: cached.messages,
            savedAt: cached.savedAt,
          };
        }
      }

      // Fallback to sessionStorage (legacy)
      const raw = sessionStorage.getItem("wth:chat-cached-session");
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as Partial<CachedChatSessionPayload>;
        const messages = Array.isArray(parsed.messages)
          ? parsed.messages.map(coerceCachedMessage).filter((m): m is Message => m !== null)
          : [];

        if (messages.length === 0) return null;

        return {
          sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
          messages,
          savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
        };
      } catch {
        sessionStorage.removeItem("wth:chat-cached-session");
        return null;
      }
    },
    []
  );

  const hydrateFromCache = useCallback(
    (sid?: string): boolean => {
      const cached = readCache(sid);
      if (!cached) return false;

      const store = useChatStore.getState();
      store.setSessionId(cached.sessionId);
      store.setMessages(cached.messages);
      return true;
    },
    [readCache]
  );

  const clearCache = useCallback((sid?: string) => {
    if (sid) {
      clearCachedSessionMessages(sid);
    }
    try {
      sessionStorage.removeItem("wth:chat-cached-session");
    } catch {
      // ignore
    }
  }, []);

  // Auto-write on unmount
  useEffect(() => {
    return () => {
      writeCache();
    };
  }, [writeCache]);

  return { writeCache, readCache, hydrateFromCache, clearCache };
}

export { getCachedSessionMessages, getCachedSessionList, setCachedSessionList, isCacheExpired };
