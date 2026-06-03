"use client";

import { BookOpen, X, ExternalLink } from "lucide-react";
import type { SearchSource } from "@/lib/chat/types";

interface SourcesDrawerProps {
  sources: SearchSource[];
  onClose: () => void;
}

export function SourcesDrawer({ sources, onClose }: SourcesDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl shadow-2xl border-t border-outline-variant/20 max-h-[60vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-2 text-on-surface">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">参考来源</span>
            <span className="text-xs text-on-surface-variant/60 ml-1">{sources.length} 条</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-2xl hover:bg-surface-container-high transition-colors group"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-container text-primary text-xs flex items-center justify-center font-medium mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-on-surface truncate group-hover:text-primary transition-colors">
                  {s.title}
                </div>
                <div className="text-xs text-on-surface-variant/60 truncate mt-0.5">{s.url}</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-on-surface-variant/40 group-hover:text-primary transition-colors mt-0.5" />
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
