"use client";

import { useState, useRef, useCallback } from "react";
import { Pencil, Check, X } from "lucide-react";
import type { Message } from "@/lib/chat/types";

interface UserBubbleProps {
  message: Message;
  onEdit?: (newContent: string) => void;
}

export function UserBubble({ message, onEdit }: UserBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStartEdit = useCallback(() => {
    setEditText(message.content);
    setIsEditing(true);
    // Auto-focus and resize after render
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = "";
        el.style.height = el.scrollHeight + "px";
      }
    });
  }, [message.content]);

  const handleConfirm = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(trimmed);
    }
    setIsEditing(false);
  }, [editText, message.content, onEdit]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditText(message.content);
  }, [message.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(e.target.value);
      e.target.style.height = "";
      e.target.style.height = e.target.scrollHeight + "px";
    },
    []
  );

  return (
    <div className="flex w-full justify-end py-1 group">
      <div className="flex flex-col items-end gap-1.5 max-w-[85%] md:max-w-[70%]">
        {message.imageUrl && (
          <div className="bg-surface-container-high rounded-sm overflow-hidden shadow-sm max-w-xs sm:max-w-sm">
            <img
              src={message.imageUrl}
              alt="Uploaded"
              className="w-full h-auto object-contain block"
              loading="lazy"
              onClick={() => window.open(message.imageUrl, "_blank")}
            />
          </div>
        )}
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5 text-on-surface text-base leading-relaxed w-full resize-none focus:outline-none focus:ring-2 focus:ring-secondary/30 min-h-[40px]"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-on-secondary hover:opacity-90 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            {/* Edit button — appears on hover */}
            {onEdit && (
              <button
                onClick={handleStartEdit}
                title="编辑"
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-all mt-0.5"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {message.content && (
              <div className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5">
                <p className="text-on-surface text-base leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
