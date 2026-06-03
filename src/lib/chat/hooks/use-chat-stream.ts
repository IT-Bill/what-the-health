"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/lib/chat/store";
import { refreshSessions } from "@/lib/swr";
import type { Message, SearchSource, ToolCallInfo } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

interface SendOptions {
  startNewSession?: boolean;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);
  const assistantAccRef = useRef("");
  const reasoningAccRef = useRef("");
  const thinkingStartRef = useRef<number>(0);

  const processSseEvent = useCallback(
    (event: SseEvent, assistantId: string) => {
      const store = useChatStore.getState();
      switch (event.type) {
        case "session": {
          const sid = event.sessionId as string;
          if (sid) {
            store.setSessionId(sid);
          }
          break;
        }
        case "agent_start": {
          store.setCurrentAgentState("thinking");
          thinkingStartRef.current = Date.now();
          break;
        }
        case "turn_end": {
          const tc = (event.turnCount as number) ?? 0;
          store.updateMessage(assistantId, { turnCount: tc });
          break;
        }
        case "text_delta": {
          const delta = (event.delta as string) ?? "";
          assistantAccRef.current += delta;
          store.updateMessage(assistantId, {
            content: assistantAccRef.current,
          });
          break;
        }
        case "reasoning_delta": {
          const delta = (event.delta as string) ?? "";
          reasoningAccRef.current += delta;
          const duration = thinkingStartRef.current
            ? Math.round((Date.now() - thinkingStartRef.current) / 1000)
            : 0;
          store.updateMessage(assistantId, {
            reasoning: reasoningAccRef.current,
            thinkingDuration: duration,
          });
          break;
        }
        case "tool_start": {
          store.setCurrentAgentState("tools");
          const tool = event.tool as ToolCallInfo;
          const msg = store.getMessageById(assistantId);
          if (!msg) break;
          const existing = msg.toolCalls ?? [];
          if (existing.find((t) => t.id === tool.id)) break;
          // Move any pre-tool text into preToolText and clear content
          const preToolText =
            (msg.preToolText ?? "") +
            (assistantAccRef.current.trim() ? assistantAccRef.current : "");
          assistantAccRef.current = "";
          store.updateMessage(assistantId, {
            toolCalls: [...existing, tool],
            preToolText,
            content: "",
          });
          break;
        }
        case "tool_end": {
          const tool = event.tool as ToolCallInfo;
          const sources = event.sources as SearchSource[] | undefined;
          const msg = store.getMessageById(assistantId);
          if (!msg) break;
          const updated = (msg.toolCalls ?? []).map((t) =>
            t.id === tool.id ? tool : t
          );
          const nextSources = sources
            ? [...(msg.sources ?? []), ...sources]
            : msg.sources;
          store.updateMessage(assistantId, {
            toolCalls: updated,
            sources: nextSources,
          });
          break;
        }
        case "message_end": {
          const msg = event.message as { role: string; text: string };
          if (msg.role === "assistant") {
            store.setCurrentAgentState("idle");
          }
          break;
        }
        case "agent_end": {
          store.setCurrentAgentState("idle");
          store.updateMessage(assistantId, {
            content: assistantAccRef.current,
            isStreaming: false,
          });
          break;
        }
        case "error": {
          const msg = (event.message as string) ?? "未知错误";
          store.setError(msg);
          store.updateMessage(assistantId, {
            content: `⚠️ ${msg}`,
            isStreaming: false,
          });
          break;
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, options: SendOptions = {}) => {
      const state = useChatStore.getState();
      if (state.isStreaming) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        imageUrl: options.imageUrl,
      };
      const assistantId = `a-${Date.now()}`;

      const assistantMsg: Message = {
        id: assistantId,
        role: "agent",
        content: "",
        isStreaming: true,
        toolCalls: [],
      };

      const nextMessages = options.startNewSession
        ? [userMsg, assistantMsg]
        : [...state.messages, userMsg, assistantMsg];

      if (options.startNewSession) {
        state.setSessionId(undefined);
      }
      state.setMessages(nextMessages);
      state.setIsStreaming(true);
      state.setCurrentAgentState("thinking");
      state.setError(null);
      state.setStreamingMessageId(assistantId);
      assistantAccRef.current = "";
      reasoningAccRef.current = "";
      thinkingStartRef.current = Date.now();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            sessionId: options.startNewSession ? undefined : state.sessionId,
            imageUrl: options.imageUrl,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `请求失败 (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as SseEvent;
              processSseEvent(event, assistantId);
            } catch {
              // ignore malformed events
            }
          }
        }
      } catch (err) {
        if (isAbortError(err)) {
          // User cancelled
        } else {
          const msg =
            err instanceof Error ? err.message : "连接出错，请稍后再试。";
          const store = useChatStore.getState();
          store.setError(msg);
          store.updateMessage(assistantId, {
            content: `⚠️ ${msg}`,
            isStreaming: false,
          });
        }
      } finally {
        const store = useChatStore.getState();
        store.setIsStreaming(false);
        store.setCurrentAgentState("idle");
        store.setStreamingMessageId(null);
        abortRef.current = null;

        // Refresh sessions list
        refreshSessions().catch(console.error);
      }
    },
    [processSseEvent]
  );

  const retryMessage = useCallback(
    async (assistantMsgId: string, userContent: string) => {
      const state = useChatStore.getState();
      if (state.isStreaming) return;

      const newAssistantId = `a-${Date.now()}`;

      // Reset the target assistant message in-place
      const nextMessages = state.messages.map((m) =>
        m.id === assistantMsgId
          ? { ...m, id: newAssistantId, content: "", isStreaming: true, toolCalls: [], sources: undefined, reasoning: undefined }
          : m
      );
      state.setMessages(nextMessages);
      state.setIsStreaming(true);
      state.setCurrentAgentState("thinking");
      state.setError(null);
      state.setStreamingMessageId(newAssistantId);
      assistantAccRef.current = "";
      reasoningAccRef.current = "";
      thinkingStartRef.current = Date.now();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userContent,
            sessionId: state.sessionId,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `请求失败 (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as SseEvent;
              processSseEvent(event, newAssistantId);
            } catch {
              // ignore malformed events
            }
          }
        }
      } catch (err) {
        if (isAbortError(err)) {
          // User cancelled
        } else {
          const msg =
            err instanceof Error ? err.message : "连接出错，请稍后再试。";
          const store = useChatStore.getState();
          store.setError(msg);
          store.updateMessage(newAssistantId, {
            content: `⚠️ ${msg}`,
            isStreaming: false,
          });
        }
      } finally {
        const store = useChatStore.getState();
        store.setIsStreaming(false);
        store.setCurrentAgentState("idle");
        store.setStreamingMessageId(null);
        abortRef.current = null;

        // Refresh sessions list
        refreshSessions().catch(console.error);
      }
    },
    [processSseEvent]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, retryMessage, cancelStream };
}
