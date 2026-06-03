"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { NotificationBell } from "@/components/notification-bell";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { useChatStore } from "@/lib/chat/store";
import {
  useChatStream,
  useChatSession,
  useChatCache,
  useVoiceRecording,
} from "@/lib/chat/hooks";
import { useUser, refreshSessions } from "@/lib/swr";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { SessionSidebar } from "./session-sidebar";
import { SourcesDrawer } from "./sources-drawer";
import type { SearchSource } from "@/lib/chat/types";
import {
  CHAT_HAS_ACTIVITY_KEY,
  CHAT_RESTORE_LATEST_KEY,
  PENDING_VOICE_TEXT_KEY,
  VOICE_SUBMIT_EVENT,
  type PendingVoiceText,
  type VoiceSubmitEventDetail,
} from "@/lib/voice-events";
import {
  getCachedSessionMessages,
  getCachedSessionList,
  isCacheExpired,
  isCacheOwnedBy,
  clearAllChatCache,
} from "@/lib/chat/hooks/use-chat-cache";

interface ChatCoreProps {
  initialSessionId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function readPendingVoiceText(): PendingVoiceText | null {
  const raw = sessionStorage.getItem(PENDING_VOICE_TEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingVoiceText>;
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!text) return null;
    return { text, startNewSession: parsed.startNewSession === true };
  } catch {
    const text = raw.trim();
    return text ? { text, startNewSession: true } : null;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatCore({ initialSessionId }: ChatCoreProps) {
  const showSidebar = useChatStore((s) => s.showSidebar);
  const { sendMessage, retryMessage } = useChatStream();
  const {
    loadSession,
    startNewSession,
    refreshSessions,
    deleteSession,
    renameSession,
    togglePinSession,
  } = useChatSession();
  const { writeCache } = useChatCache();
  const {
    isRecording,
    volumeBars,
    recordingTextRef,
    startRecording,
    stopRecording,
    cleanup: cleanupVoice,
  } = useVoiceRecording();

  // Local UI state (not in store)
  const [activeSources, setActiveSources] = useState<SearchSource[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSessionBootstrapDone, setIsSessionBootstrapDone] = useState(false);

  const isStreamingRef = useRef(false);
  const hadPendingVoiceOnMountRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const sessionId = useChatStore((s) => s.sessionId);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Track latest session ID for quick return
  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem("wth:latest-chat-session-id", sessionId);
    }
  }, [sessionId]);

  // Auth check via SWR
  const { data: userData } = useUser();
  const userId = userData?.user?.id;

  // Clear cross-user stale cache when user changes
  useEffect(() => {
    if (!userId) return;
    if (!isCacheOwnedBy(userId)) {
      clearAllChatCache();
    }
  }, [userId]);

  // Cache write on unmount
  useEffect(() => {
    return () => writeCache(userId);
  }, [writeCache, userId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    (overrideText?: string, opts?: { startNewSession?: boolean }) => {
      const state = useChatStore.getState();
      const text = (overrideText ?? state.input).trim();
      const imageUrl = state.pendingImage?.url;

      if ((!text && !imageUrl) || state.isStreaming) return;

      if (state.pendingImage) {
        URL.revokeObjectURL(state.pendingImage.previewUrl);
      }
      useChatStore.getState().setPendingImage(null);
      useChatStore.getState().setInput("");

      sendMessage(text, { startNewSession: opts?.startNewSession, imageUrl });
    },
    [sendMessage]
  );

  const handleRetry = useCallback(
    (assistantMsgId: string, userContent: string) => {
      retryMessage(assistantMsgId, userContent);
    },
    [retryMessage]
  );

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        alert("仅支持 JPEG、PNG、WebP、GIF 格式");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("图片大小不能超过 10MB");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      useChatStore.getState().setPendingImage({ file, previewUrl, uploading: true });

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload/image?prefix=chat", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "上传失败");
        useChatStore.getState().setPendingImage({ file, previewUrl, uploading: false, url: data.url });
      } catch (err) {
        useChatStore.getState().setError(err instanceof Error ? err.message : "上传失败");
        useChatStore.getState().setPendingImage(null);
        URL.revokeObjectURL(previewUrl);
      }
    },
    []
  );

  const handleStopVoiceRecording = useCallback(() => {
    stopRecording();
    const text = recordingTextRef.current.trim();
    if (text) {
      useChatStore.getState().setInput(text);
      // Auto-resize textarea
      queueMicrotask(() => {
        const el = document.querySelector("textarea") as HTMLTextAreaElement | null;
        if (el) {
          el.style.height = "";
          el.style.height = el.scrollHeight + "px";
        }
      });
    }
  }, [stopRecording]);

  const exportSession = useCallback(async (sid: string, title: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sid}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const messages = (data.session?.messages ?? []).map(
        (m: { role: string; content: string; toolCallsJson?: string }) => ({
          role: m.role === "assistant" ? "assistant" : m.role,
          content: m.content,
          ...(m.toolCallsJson ? { toolCallsJson: m.toolCallsJson } : {}),
        })
      );
      const blob = new Blob(
        [JSON.stringify({ title, messages }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export session error:", err);
    }
  }, []);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setImportError(null);

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await fetch("/api/chat/sessions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });
        const data = await res.json();
        if (!res.ok) {
          setImportError(data.error ?? "导入失败");
          return;
        }
        await refreshSessions();
        if (data.session?.id) {
          loadSession(data.session.id);
        }
      } catch {
        setImportError("文件格式无效，请选择有效的对话导出文件");
      }
    },
    [refreshSessions, loadSession]
  );

  const prepareRestoreLatestOnReturn = useCallback(() => {
    writeCache();
    if (sessionStorage.getItem(CHAT_HAS_ACTIVITY_KEY) === "1") {
      sessionStorage.setItem(CHAT_RESTORE_LATEST_KEY, "1");
    }
  }, [writeCache]);

  const markChatActivity = useCallback(() => {
    sessionStorage.setItem(CHAT_HAS_ACTIVITY_KEY, "1");
  }, []);

  const openProfileSetupSessionIfNeeded = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/sessions/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "profile-setup" }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const sid = data.session?.id as string | undefined;
      if (!sid) return false;
      await refreshSessions();
      await loadSession(sid, { silent: true });
      useChatStore.getState().setShowSidebar(false);
      useChatStore.getState().setError(null);
      return true;
    } catch (err) {
      console.error("Open profile setup session error:", err);
      return false;
    }
  }, [refreshSessions, loadSession]);

  const beginNewSession = useCallback(async () => {
    const openedProfileSetup = await openProfileSetupSessionIfNeeded();
    if (!openedProfileSetup) {
      startNewSession();
    }
  }, [openProfileSetupSessionIfNeeded, startNewSession]);

  // ---------------------------------------------------------------------------
  // Effects: Session initialization
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadInitialSessions() {
      // Verify cache ownership before hydrating
      let currentUserId: string | undefined;
      try {
        const meRes = await fetch("/api/me", { signal: controller.signal });
        if (meRes.ok) {
          const meData = await meRes.json();
          currentUserId = meData.user?.id;
        }
      } catch {
        // ignore auth errors
      }
      if (currentUserId && !isCacheOwnedBy(currentUserId)) {
        clearAllChatCache();
      }

      try {
        if (initialSessionId) {
          // Hydrate from cache first
          const cached = getCachedSessionMessages(initialSessionId);
          if (cached && cached.messages.length > 0 && !isCacheExpired(cached.savedAt)) {
            useChatStore.getState().setMessages(cached.messages);
            useChatStore.getState().setSessionId(initialSessionId);
          }

          const cachedList = getCachedSessionList();
          if (cachedList && cachedList.sessions.length > 0 && !isCacheExpired(cachedList.savedAt)) {
            useChatStore.getState().setSessions(cachedList.sessions);
          }

          let sessionsRes: Response;
          try {
            [sessionsRes] = await Promise.all([
              fetch("/api/chat/sessions", { signal: controller.signal }),
              loadSession(initialSessionId, { silent: true }),
            ]);
          } catch (err) {
            if (isAbortError(err)) return;
            throw err;
          }
          if (cancelled) return;
          if (sessionsRes.status === 401) {
            window.location.href = "/login";
            return;
          }
          const data = await sessionsRes.json();
          if (cancelled) return;
          if (data?.sessions) useChatStore.getState().setSessions(data.sessions);
          if (!cancelled) setIsSessionBootstrapDone(true);
          return;
        }

        // For /chat (no specific session)
        const cachedList = getCachedSessionList();
        if (cachedList && cachedList.sessions.length > 0 && !isCacheExpired(cachedList.savedAt)) {
          useChatStore.getState().setSessions(cachedList.sessions);
        }

        let r: Response;
        try {
          r = await fetch("/api/chat/sessions", { signal: controller.signal });
        } catch (err) {
          if (isAbortError(err)) return;
          throw err;
        }
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        if (data?.sessions) {
          useChatStore.getState().setSessions(data.sessions);
          const shouldRestoreLatest =
            sessionStorage.getItem(CHAT_RESTORE_LATEST_KEY) === "1" &&
            !hadPendingVoiceOnMountRef.current;

          if (shouldRestoreLatest && data.sessions.length > 0) {
            await loadSession(data.sessions[0].id, { silent: true });
          } else {
            const openedProfileSetup = await openProfileSetupSessionIfNeeded();
            if (!openedProfileSetup && data.sessions.length === 0) {
              startNewSession();
            }
          }
        }
      } catch (err) {
        if (isAbortError(err)) return;
        console.error(err);
      } finally {
        if (!cancelled) setIsSessionBootstrapDone(true);
      }
    }

    loadInitialSessions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialSessionId, loadSession, refreshSessions, startNewSession, openProfileSetupSessionIfNeeded]);

  // ---------------------------------------------------------------------------
  // Effects: Pending voice text — bottom nav voice button sends directly
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pendingVoiceText = readPendingVoiceText();
    if (pendingVoiceText) {
      hadPendingVoiceOnMountRef.current = true;
      sessionStorage.removeItem(PENDING_VOICE_TEXT_KEY);
      queueMicrotask(() => {
        handleSend(pendingVoiceText.text, { startNewSession: pendingVoiceText.startNewSession });
      });
      return;
    }

    // Backward compatibility for old /chat?voice=... links
    const params = new URLSearchParams(window.location.search);
    const voiceText = params.get("voice");
    if (!voiceText) return;

    hadPendingVoiceOnMountRef.current = true;
    queueMicrotask(() => {
      handleSend(voiceText, { startNewSession: true });
    });
    params.delete("voice");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [handleSend]);

  // VOICE_SUBMIT_EVENT listener — bottom nav voice button sends directly
  useEffect(() => {
    const handleVoiceSubmit = (event: Event) => {
      const detail = (event as CustomEvent<VoiceSubmitEventDetail>).detail;
      handleSend(detail?.text, { startNewSession: detail?.startNewSession });
    };

    window.addEventListener(VOICE_SUBMIT_EVENT, handleVoiceSubmit);
    return () => window.removeEventListener(VOICE_SUBMIT_EVENT, handleVoiceSubmit);
  }, [handleSend]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col relative overflow-hidden bg-background">
      {/* Mobile TopAppBar */}
      <header className="fixed inset-x-0 top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 md:hidden">
        <button
          onClick={() => useChatStore.getState().setShowSidebar(!showSidebar)}
          className="flex items-center gap-2 text-on-surface-variant"
        >
          <Icon name={showSidebar ? "close" : "menu"} />
        </button>
        <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
          Mindful
        </div>
        <NotificationBell className="w-9 h-9" />
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex fixed inset-x-0 top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 justify-between items-center w-full px-16 h-20">
        <div className="flex items-center gap-4">
          <Icon name="spa" />
          <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
            Mindful
          </div>
        </div>
        <nav className="flex gap-8 items-center h-full">
          <Link
            href={sessionId ? `/chat/${sessionId}` : "/chat"}
            className="text-primary font-bold h-full flex items-center border-b-2 border-primary"
          >
            Chat
          </Link>
          <Link
            href="/discover"
            onClick={prepareRestoreLatestOnReturn}
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Discover
          </Link>
          <Link
            href="/memory"
            onClick={prepareRestoreLatestOnReturn}
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Memory
          </Link>
          <Link
            href="/profile"
            onClick={prepareRestoreLatestOnReturn}
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Profile
          </Link>
        </nav>
        <NotificationBell />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden pt-16 md:pt-20">
        <SessionSidebar
          onNewSession={beginNewSession}
          onLoadSession={loadSession}
          onRenameSession={renameSession}
          onTogglePinSession={togglePinSession}
          onDeleteSession={deleteSession}
          onExportSession={exportSession}
          onImportFile={handleImportFile}
          importError={importError}
        />

        <main className="flex-1 min-h-0 flex flex-col max-w-[800px] mx-auto w-full overflow-hidden relative z-10 pb-36 md:pb-8">
          {/* Chat History */}
          <div
            ref={chatContainerRef}
            className="flex-1 w-full px-4 md:px-6 overflow-y-auto no-scrollbar flex flex-col gap-1 pt-4"
          >
            <MessageList
              onRetry={(assistantMsgId, userContent) => {
                markChatActivity();
                handleRetry(assistantMsgId, userContent);
              }}
              onSendSuggestion={(text) => {
                markChatActivity();
                handleSend(text);
              }}
              onShowSources={setActiveSources}
            />

            {error && (
              <div className="flex w-full justify-center py-2">
                <div className="bg-error-container text-on-error-container rounded-2xl px-4 py-2 text-sm">
                  {error}
                </div>
              </div>
            )}
          </div>

          <ChatInput
            onSend={() => {
              markChatActivity();
              handleSend();
            }}
            onImageSelect={handleImageSelect}
            onStartVoiceRecording={startRecording}
            onStopVoiceRecording={handleStopVoiceRecording}
            onCleanupRecording={cleanupVoice}
            isRecording={isRecording}
            volumeBars={volumeBars}
          />
        </main>
      </div>

      <BottomNavBar />
      {activeSources && (
        <SourcesDrawer sources={activeSources} onClose={() => setActiveSources(null)} />
      )}
    </div>
  );
}
