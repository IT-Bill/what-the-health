"use client";

import { useCallback } from "react";
import { useChatStore } from "@/lib/chat/store";
import { AgentMessage } from "./agent-message";
import { UserBubble } from "./user-bubble";
import { Icon } from "@/components/icon";

interface MessageListProps {
  onRetry: (assistantMsgId: string, userContent: string) => void;
  onSendSuggestion: (text: string) => void;
  onShowSources: (sources: NonNullable<import("@/lib/chat/types").Message["sources"]>) => void;
}

export function MessageList({ onRetry, onSendSuggestion, onShowSources }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sessionId = useChatStore((s) => s.sessionId);

  const handleRetry = useCallback(
    (msgId: string, idx: number) => {
      const prevUser = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");
      if (prevUser) onRetry(msgId, prevUser.content);
    },
    [messages, onRetry]
  );

  return (
    <>
      {/* Welcome screen — only when explicitly in new session state */}
      {sessionId === undefined && messages[0]?.id === "init" && !isStreaming && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 gap-6">
          <h1 className="text-3xl font-medium text-on-surface tracking-tight">
            在这个当下，你感觉如何？
          </h1>
          <div className="flex justify-center gap-2">
            {[
              { icon: "self_improvement", label: "帮我放松" },
              { icon: "edit_note", label: "写日记" },
              { icon: "psychology", label: "倾诉烦恼" },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => onSendSuggestion(s.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high transition-colors text-xs text-on-surface-variant"
              >
                <Icon name={s.icon} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {(sessionId !== undefined || messages[0]?.id !== "init" || isStreaming) && (
        <>
          {messages.map((msg, idx) =>
            msg.role === "agent" ? (
              <AgentMessage
                key={msg.id}
                message={msg}
                onRetry={() => handleRetry(msg.id, idx)}
                onShowSources={msg.sources?.length ? () => onShowSources(msg.sources!) : undefined}
              />
            ) : (
              <UserBubble key={msg.id} message={msg} />
            )
          )}
        </>
      )}
    </>
  );
}
