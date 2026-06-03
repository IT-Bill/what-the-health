"use client";

import { useCallback } from "react";
import { useChatStore } from "@/lib/chat/store";
import type { Message } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatSession() {
  const loadSession = useCallback(
    async (sid: string, opts?: { silent?: boolean }) => {
      const store = useChatStore.getState();
      if (!opts?.silent) {
        store.setIsStreaming(true);
      }
      store.setSessionId(sid);
      store.setShowSidebar(false);
      store.setError(null);

      try {
        const res = await fetch(`/api/chat/sessions/${sid}/messages`);
        if (res.status === 404) {
          store.setError("会话不存在或已被删除");
          startNewSession();
          return;
        }
        const data = await res.json();
        if (data.session?.messages) {
          const nextMessages: Message[] = data.session.messages.map(
            (m: {
              id: string;
              role: string;
              content: string;
              imageUrl?: string;
              reasoning?: string;
              toolCallsJson?: string;
            }) => ({
              id: m.id,
              role: m.role === "user" ? "user" : "agent",
              content: m.content,
              imageUrl: m.imageUrl ?? undefined,
              reasoning: m.reasoning ?? undefined,
              toolCalls: m.toolCallsJson ? JSON.parse(m.toolCallsJson) : undefined,
            })
          );
          store.setMessages(nextMessages);
        }
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        console.error("Load session error:", err);
        store.setError("加载会话失败");
        startNewSession();
      } finally {
        if (!opts?.silent) {
          store.setIsStreaming(false);
        }
      }
    },
    []
  );

  const startNewSession = useCallback(() => {
    const store = useChatStore.getState();
    store.setMessages([
      {
        id: "init",
        role: "agent",
        content: "欢迎回来。我是 Mindful，你的疗愈陪伴者。在这个当下，你感觉如何？",
      },
    ]);
    store.setSessionId(undefined);
    store.setError(null);
    store.setShowSidebar(false);
    store.setIsStreaming(false);
    store.setCurrentAgentState("idle");
    store.setStreamingMessageId(null);
  }, []);

  const refreshSessions = useCallback(async () => {
    const response = await fetch("/api/chat/sessions");
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await response.json();
    if (data?.sessions) {
      useChatStore.getState().setSessions(data.sessions);
    }
  }, []);

  const deleteSession = useCallback(
    async (sid: string) => {
      if (!window.confirm("确定要删除这个会话吗？此操作不可撤销。")) return;
      try {
        const res = await fetch(`/api/chat/sessions/${sid}`, { method: "DELETE" });
        if (res.ok) {
          const store = useChatStore.getState();
          store.removeSession(sid);
          if (store.sessionId === sid) {
            startNewSession();
          }
        }
      } catch (err) {
        console.error("Delete session error:", err);
      }
    },
    [startNewSession]
  );

  const renameSession = useCallback(
    async (sid: string, newTitle: string) => {
      try {
        const res = await fetch(`/api/chat/sessions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        const data = await res.json();
        if (data.session) {
          useChatStore.getState().updateSession(sid, { title: data.session.title });
        }
      } catch (err) {
        console.error("Rename session error:", err);
      }
    },
    []
  );

  const togglePinSession = useCallback(
    async (sid: string, currentPinned: boolean) => {
      try {
        const res = await fetch(`/api/chat/sessions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !currentPinned }),
        });
        const data = await res.json();
        if (data.session) {
          const store = useChatStore.getState();
          const updated = store.sessions.map((s) =>
            s.id === sid ? { ...s, pinned: data.session.pinned as boolean } : s
          );
          // Re-sort: pinned first, then by updatedAt desc
          const sorted = updated.sort((a, b) => {
            if (a.pinned !== b.pinned)
              return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          store.setSessions(sorted);
        }
      } catch (err) {
        console.error("Pin session error:", err);
      }
    },
    []
  );

  return {
    loadSession,
    startNewSession,
    refreshSessions,
    deleteSession,
    renameSession,
    togglePinSession,
  };
}
