"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Icon } from "@/components/icon";
import { useChatStore } from "@/lib/chat/store";
import type { ChatSession } from "@/lib/chat/types";

interface SessionSidebarProps {
  onNewSession: () => void;
  onLoadSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onTogglePinSession: (id: string, currentPinned: boolean) => void;
  onDeleteSession: (id: string) => void;
  onExportSession: (id: string, title: string) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
}

export function SessionSidebar({
  onNewSession,
  onLoadSession,
  onRenameSession,
  onTogglePinSession,
  onDeleteSession,
  onExportSession,
  onImportFile,
  importError,
}: SessionSidebarProps) {
  const sessions = useChatStore((s) => s.sessions);
  const sessionId = useChatStore((s) => s.sessionId);
  const showSidebar = useChatStore((s) => s.showSidebar);
  const setShowSidebar = useChatStore((s) => s.setShowSidebar);

  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Long-press for session items (mobile-friendly menu trigger)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTargetRef = useRef<string | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const LONG_PRESS_DURATION = 500; // ms
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px

  const handleSessionPointerDown = useCallback((sid: string, e: React.PointerEvent) => {
    longPressTargetRef.current = sid;
    longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      if (longPressTargetRef.current === sid) {
        setActiveMenuSessionId(sid);
        // Trigger haptic feedback if available
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(50);
        }
      }
      longPressTimerRef.current = null;
    }, LONG_PRESS_DURATION);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTargetRef.current = null;
    longPressStartPosRef.current = null;
  }, []);

  const handleSessionPointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressStartPosRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - longPressStartPosRef.current.x);
    const dy = Math.abs(e.clientY - longPressStartPosRef.current.y);
    if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handleSessionPointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleSessionContextMenu = useCallback((sid: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveMenuSessionId(sid);
  }, []);

  // Close session menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuSessionId(null);
      }
    }
    if (activeMenuSessionId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeMenuSessionId]);

  return (
    <>
      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - Sessions */}
      <aside
        className={`${
          showSidebar
            ? "fixed top-0 left-0 h-full w-5/6 z-40 bg-surface/95 backdrop-blur-xl flex flex-col overflow-hidden md:relative md:inset-auto md:w-72 md:bg-transparent md:backdrop-blur-none"
            : "hidden md:flex md:w-72 md:flex-col md:overflow-hidden"
        } md:border-r md:border-outline-variant/20 md:bg-surface-container-low/50`}
      >
        <div className="flex items-center justify-between p-4 md:p-4 border-b border-outline-variant/20 md:border-none">
          <h2 className="font-[var(--font-display)] text-lg font-medium text-on-surface">
            对话历史
          </h2>
          <button
            onClick={() => setShowSidebar(false)}
            className="md:hidden text-on-surface-variant"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => {
              void onNewSession();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-primary bg-primary-container/40 hover:bg-primary-container/60 transition-colors"
          >
            <Icon name="add" />
            <span className="text-sm font-medium">新建对话</span>
          </button>
          {sessions.map((s) => {
            const isEditing = editingSessionId === s.id;
            const isMenuOpen = activeMenuSessionId === s.id;
            return (
              <div
                key={s.id}
                onPointerDown={(e) => handleSessionPointerDown(s.id, e)}
                onPointerMove={handleSessionPointerMove}
                onPointerUp={handleSessionPointerUp}
                onPointerCancel={handleSessionPointerUp}
                onPointerLeave={handleSessionPointerUp}
                onContextMenu={(e) => handleSessionContextMenu(s.id, e)}
                className={`relative group flex items-center rounded-2xl transition-colors ${
                  sessionId === s.id
                    ? "bg-secondary-container/60 text-on-secondary-container"
                    : "hover:bg-surface-container-high/60 text-on-surface-variant"
                }`}
              >
                {isEditing ? (
                  <div className="flex-1 min-w-0 flex items-center gap-1 px-3 py-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onRenameSession(s.id, editTitle);
                          setEditingSessionId(null);
                          setEditTitle("");
                        }
                        if (e.key === "Escape") {
                          setEditingSessionId(null);
                          setEditTitle("");
                        }
                      }}
                      autoFocus
                      className="flex-1 min-w-0 text-sm font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-on-secondary-container"
                    />
                    <button
                      onClick={() => {
                        onRenameSession(s.id, editTitle);
                        setEditingSessionId(null);
                        setEditTitle("");
                      }}
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-primary hover:bg-primary-container/40 transition-colors"
                    >
                      <Icon name="check" size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingSessionId(null);
                        setEditTitle("");
                      }}
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => {
                        onLoadSession(s.id);
                      }}
                      className="flex-1 min-w-0 text-left px-4 py-3 cursor-pointer"
                    >
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {s.pinned && (
                          <Icon name="push_pin" size={12} filled />
                        )}
                        {s.title}
                      </div>
                      <div className="text-xs mt-0.5 opacity-60 truncate">
                        {s.lastMessage ?? `${s.messageCount} 条消息`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuSessionId(isMenuOpen ? null : s.id);
                      }}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-1 transition-colors ${
                        isMenuOpen
                          ? "bg-surface-container-high text-on-surface"
                          : "text-on-surface-variant hover:bg-surface-container-high/60"
                      }`}
                    >
                      <Icon name="more_vert" size={18} />
                    </button>
                  </>
                )}
                {isMenuOpen && !isEditing && (
                  <div
                    ref={menuRef}
                    className="absolute right-2 top-10 z-50 bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 py-1.5 w-44"
                  >
                    <button
                      onClick={() => {
                        setEditingSessionId(s.id);
                        setEditTitle(s.title);
                        setActiveMenuSessionId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors text-left"
                    >
                      <Icon name="edit" size={18} />
                      重命名
                    </button>
                    <button
                      onClick={() => {
                        onTogglePinSession(s.id, s.pinned);
                        setActiveMenuSessionId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors text-left"
                    >
                      <Icon name={s.pinned ? "keep_off" : "keep"} size={18} />
                      {s.pinned ? "取消置顶" : "置顶"}
                    </button>
                    <button
                      onClick={() => {
                        onExportSession(s.id, s.title);
                        setActiveMenuSessionId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors text-left"
                    >
                      <Icon name="upload_file" size={18} />
                      导出对话
                    </button>
                    <div className="mx-3 my-1 h-px bg-outline-variant/30" />
                    <button
                      onClick={() => {
                        onDeleteSession(s.id);
                        setActiveMenuSessionId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors text-left"
                    >
                      <Icon name="delete" size={18} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Import button at sidebar bottom */}
        <div className="p-2 pb-[calc(0.5rem+76px)] md:pb-2 border-t border-outline-variant/20 z-50">
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
          />
          {importError && (
            <p className="text-xs text-error px-3 pb-2">{importError}</p>
          )}
          <button
            onClick={() => { importFileRef.current?.click(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-on-surface-variant hover:bg-surface-container-high/60 transition-colors"
          >
            <Icon name="autorenew" size={18} />
            <span className="text-sm">导入对话</span>
          </button>
        </div>
      </aside>
    </>
  );
}
