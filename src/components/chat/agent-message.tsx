"use client";

import { useState, useRef, useCallback } from "react";
import { Copy, RotateCcw, BookOpen, Check } from "lucide-react";
import { Volume2, VolumeX } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { ThinkingProcess } from "./thinking-process";
import type { Message } from "@/lib/chat/types";

interface AgentMessageProps {
  message: Message;
  onRetry?: () => void;
  onShowSources?: () => void;
  onQuickReply?: (text: string) => void;
}

export function AgentMessage({ message, onRetry, onShowSources, onQuickReply }: AgentMessageProps) {
  const [copied, setCopied] = useState(false);
  const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSources = (message.sources?.length ?? 0) > 0;
  const hasQuickReplies = !message.isStreaming && (message.quickReplies?.length ?? 0) > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTts = useCallback(async () => {
    // Stop if already playing
    if (ttsState === "playing") {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = "";
      audioRef.current = null;
      setTtsState("idle");
      return;
    }
    if (ttsState === "loading") return;

    const text = message.content.slice(0, 1000).replace(/[#*`>~\[\]]/g, "").trim();
    if (!text) return;

    setTtsState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      await audio.play();
      setTtsState("playing");
    } catch (err) {
      console.error("[TTS]", err);
      setTtsState("idle");
    }
  }, [ttsState, message.content]);

  return (
    <div className="w-full py-3">
      <ThinkingProcess
        reasoning={message.reasoning}
        toolCalls={message.toolCalls}
        isStreaming={message.isStreaming}
        turnCount={message.turnCount}
      />
      {/* Backward compatibility: preToolText when no reasoning */}
      {message.preToolText && !message.reasoning && (
        <p className="italic text-on-surface-variant/70 text-sm mb-2">{message.preToolText}</p>
      )}
      <div className="text-on-surface text-base leading-relaxed">
        <MarkdownContent text={message.content} />
      </div>
      {/* Quick reply chips */}
      {hasQuickReplies && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.quickReplies!.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onQuickReply?.(opt)}
              className="px-3 py-1.5 rounded-full border border-secondary/40 bg-secondary-container/30 text-sm text-on-secondary-container hover:bg-secondary-container/60 transition-colors"
            >
              {opt}
            </button>
          ))}
          <span className="self-center text-xs text-on-surface-variant/50">或在输入框输入</span>
        </div>
      )}
      {/* Action bar */}
      {!message.isStreaming && message.content && (
        <div className="flex items-center gap-0.5 mt-2 -ml-1.5">
          <button
            onClick={handleCopy}
            title={copied ? "已复制" : "复制"}
            className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              title="重新生成"
              className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => void handleTts()}
            title={ttsState === "playing" ? "停止朗读" : "朗读"}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              ttsState === "playing"
                ? "text-secondary hover:bg-surface-container-high"
                : ttsState === "loading"
                ? "text-on-surface-variant/30 cursor-wait"
                : "text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {ttsState === "playing" ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {hasSources && (
            <button
              onClick={() => onShowSources?.()}
              title="参考来源"
              className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
