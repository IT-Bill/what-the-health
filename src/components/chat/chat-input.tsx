"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Image, FileText } from "lucide-react";
import { Icon } from "@/components/icon";
import { useChatStore } from "@/lib/chat/store";

interface ChatInputProps {
  onSend: () => void;
  onCancel: () => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onCleanupRecording: () => void;
  isRecording: boolean;
  volumeBars: number[];
}

export function ChatInput({
  onSend,
  onCancel,
  onImageSelect,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onCleanupRecording,
  isRecording: isRecordingProp,
  volumeBars,
}: ChatInputProps) {
  const input = useChatStore((s) => s.input);
  const setInput = useChatStore((s) => s.setInput);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const pendingImage = useChatStore((s) => s.pendingImage);
  const setPendingImage = useChatStore((s) => s.setPendingImage);
  const showAttachmentMenu = useChatStore((s) => s.showAttachmentMenu);
  const setShowAttachmentMenu = useChatStore((s) => s.setShowAttachmentMenu);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const hasInput = input.trim().length > 0 || !!pendingImage?.url;

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ignore Enter while an IME is composing (e.g. selecting Pinyin candidates) —
    // that Enter is for confirming the candidate, not sending.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      // On touch-only devices (mobile), Enter inserts a newline — use the send button instead
      const isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (isMobile) return;
      e.preventDefault();
      onSend();
    }
  }

  function removePendingImage() {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
    }
  }

  return (
    <div className="fixed bottom-[76px] left-0 right-0 z-[45] bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-2 px-4 md:sticky md:bottom-0">
      <div className="max-w-[800px] mx-auto">
        {/* Hidden file inputs for image upload */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          className="hidden"
          onChange={onImageSelect}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onImageSelect}
        />

        {/* Pending image preview */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 px-4">
            <div className="relative rounded-sm overflow-hidden border border-outline-variant/30 max-w-32 max-h-32">
              <img src={pendingImage.previewUrl} alt="Preview" className="w-full h-auto object-contain" />
              {pendingImage.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <button
                onClick={removePendingImage}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
            <span className="text-xs text-on-surface-variant">
              {pendingImage.uploading ? "上传中..." : "已就绪"}
            </span>
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[28px] shadow-[0_12px_32px_rgba(45,45,45,0.04)] px-2 py-1.5">
          {/* Attachment / Cancel Button */}
          <button
            onClick={isRecordingProp ? () => { onCleanupRecording(); } : () => setShowAttachmentMenu(!showAttachmentMenu)}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <Icon name="add" className="text-2xl transition-transform duration-300" />
          </button>

          {/* Textarea or Waveform */}
          {isRecordingProp ? (
            <div className="flex-1 flex items-center justify-center gap-[3px] h-10 px-2">
              {volumeBars.map((v, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-error transition-all duration-75"
                  style={{ height: `${Math.max(4, v * 32)}px` }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="分享你的感受..."
              rows={1}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none py-2.5 px-1 text-on-surface text-base placeholder-on-surface-variant/50 max-h-[120px] overflow-y-auto no-scrollbar"
              style={{ minHeight: "40px" }}
            />
          )}

          {/* Stop / Send / Voice Button */}
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-error text-on-error hover:opacity-90 transition-all"
            >
              <Icon name="stop" size={20} />
            </button>
          ) : hasInput && !isRecordingProp ? (
            <button
              onClick={onSend}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-on-surface text-surface hover:opacity-90 transition-all"
            >
              <Icon name="arrow_upward" />
            </button>
          ) : (
            <button
              onClick={isRecordingProp ? onStopVoiceRecording : onStartVoiceRecording}
              onContextMenu={(e) => e.preventDefault()}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isRecordingProp ? "bg-error text-on-error" : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <Icon name={isRecordingProp ? "stop" : "mic_none"} size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Attachment Menu */}
      {showAttachmentMenu && (
        <div
          className="fixed inset-0 z-[55]"
          onClick={() => setShowAttachmentMenu(false)}
        >
          <div
            className="absolute bottom-24 left-4 md:left-[calc(50%-400px+16px)] bg-surface rounded-[24px] shadow-2xl border border-outline-variant/20 p-3 w-[280px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 p-1">
              {[
                { icon: Camera, label: "相机", onClick: () => { cameraInputRef.current?.click(); } },
                { icon: Image, label: "照片", onClick: () => { galleryInputRef.current?.click(); } },
                { icon: FileText, label: "文件", onClick: undefined },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-high transition-colors text-left"
                >
                  <item.icon className="w-5 h-5 text-on-surface-variant" />
                  <span className="text-sm text-on-surface">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
