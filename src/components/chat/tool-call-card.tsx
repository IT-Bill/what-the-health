"use client";

import { useState } from "react";
import { ChevronRight, Loader2, CircleCheck, CircleX } from "lucide-react";
import type { ToolCallInfo } from "@/lib/chat/types";

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const statusIcon = () => {
    switch (toolCall.status) {
      case "running":
        return <Loader2 size={14} className="animate-spin shrink-0" />;
      case "done":
        return (
          <CircleCheck
            size={14}
            className="text-on-surface-variant/50 shrink-0"
          />
        );
      case "error":
        return <CircleX size={14} className="text-error shrink-0" />;
    }
  };

  return (
    <div
      className={`rounded transition-colors duration-200 ${
        isOpen
          ? "bg-surface-container-lowest"
          : "bg-surface-container-lowest hover:bg-surface-container-low"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left min-w-0 text-on-surface-variant/50 hover:text-on-surface-variant/80 transition-colors"
      >
        {statusIcon()}
        <span className="flex-1 truncate text-sm">{toolCall.label}</span>
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-2.5 pb-2 space-y-2">
          {toolCall.result && (toolCall.status === "done" || toolCall.status === "error") ? (
            <div>
              <div className="text-[10px] font-mono text-on-surface-variant/25 uppercase tracking-widest mb-1.5 select-none">
                result
              </div>
              <div className="rounded bg-surface-container-lowest p-2">
                <pre className="text-xs text-on-surface-variant/70 whitespace-pre-wrap break-words font-sans">
                  {toolCall.result}
                </pre>
              </div>
            </div>
          ) : toolCall.status === "running" ? (
            <div className="text-xs text-on-surface-variant/50">运行中...</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
