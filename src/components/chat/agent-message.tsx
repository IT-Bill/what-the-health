"use client";

import { useState } from "react";
import { Copy, RotateCcw, BookOpen, Check } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { ThinkingProcess } from "./thinking-process";
import type { Message } from "@/lib/chat/types";

interface AgentMessageProps {
  message: Message;
  onRetry?: () => void;
  onShowSources?: () => void;
}

export function AgentMessage({ message, onRetry, onShowSources }: AgentMessageProps) {
  const [copied, setCopied] = useState(false);
  const hasSources = (message.sources?.length ?? 0) > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
