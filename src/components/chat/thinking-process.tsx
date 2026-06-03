"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ToolCallInfo } from "@/lib/chat/types";
import { ToolCallCard } from "./tool-call-card";

interface ThinkingProcessProps {
  reasoning?: string;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  turnCount?: number;
}

export function ThinkingProcess({
  reasoning,
  toolCalls,
  isStreaming,
  turnCount,
}: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(false);

  const runningTool = toolCalls?.find((t) => t.status === "running");
  const doneToolCount =
    toolCalls?.filter((t) => t.status !== "running").length ?? 0;
  const hasReasoning = !!reasoning && reasoning.length > 0;

  // Compute summary
  const summary = (() => {
    if (runningTool) return `正在使用 ${runningTool.label}...`;
    if (hasReasoning && isStreaming) return "思考中...";

    const parts: string[] = [];
    if ((turnCount ?? 0) > 0) parts.push(`思考 ${turnCount} 轮`);
    if (doneToolCount > 0) parts.push(`${doneToolCount} 次工具调用`);
    if (parts.length > 0) return parts.join(" · ");

    if (hasReasoning) return "思考过程";
    if (isStreaming) return "思考中...";
    return null;
  })();

  if (!summary) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full text-left text-sm text-on-surface-variant/50 hover:text-on-surface-variant/70 transition-colors"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <span>{summary}</span>
      </button>

      {isOpen && toolCalls && toolCalls.length > 0 && (
        <div className="mt-1.5 ml-4 space-y-1">
          {toolCalls.map((t) => (
            <ToolCallCard key={t.id} toolCall={t} />
          ))}
        </div>
      )}
    </div>
  );
}
