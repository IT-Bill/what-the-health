"use client";

import { useState } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";

interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ReasoningBlock({ content, isStreaming }: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const preview = content.replace(/\n/g, " ").slice(0, 120);
  const hasMore = content.length > 120;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/reasoning flex items-start gap-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-1 text-left flex-1 min-w-0 transition-colors hover:text-on-surface-variant/70"
      >
        <ChevronRight
          className={`w-3 h-3 mt-0.5 flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? "" : "-rotate-90"
          }`}
        />
        <span className="font-mono text-sm leading-relaxed text-on-surface-variant/50">
          {isExpanded ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <>
              {preview}
              {hasMore && "…"}
              {isStreaming && (
                <span className="inline-flex items-center gap-1 ml-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-surface-variant/40 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-on-surface-variant/50" />
                  </span>
                  <span className="text-xs">思考中…</span>
                </span>
              )}
            </>
          )}
        </span>
      </button>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded opacity-0 group-hover/reasoning:opacity-100 transition-opacity text-on-surface-variant/30 hover:text-on-surface-variant/70 flex-shrink-0 mt-0.5"
        aria-label={copied ? "已复制" : "复制"}
      >
        {copied ? (
          <Check className="w-3 h-3" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
