"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import type { Message, SearchSource } from "@/lib/chat/types";
import {
  CHAT_HAS_ACTIVITY_KEY,
  CHAT_RESTORE_LATEST_KEY,
  CHAT_SCROLL_POSITION_PREFIX,
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

function getChatScrollPositionKey(sessionId: string): string {
  return `${CHAT_SCROLL_POSITION_PREFIX}${sessionId}`;
}

function readChatScrollPosition(sessionId: string): { top: number; distanceFromBottom: number } | null {
  try {
    const raw = sessionStorage.getItem(getChatScrollPositionKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ top: number; distanceFromBottom: number }>;
    if (typeof parsed.top !== "number" || typeof parsed.distanceFromBottom !== "number") {
      return null;
    }
    return {
      top: Math.max(0, parsed.top),
      distanceFromBottom: Math.max(0, parsed.distanceFromBottom),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatCore({ initialSessionId }: ChatCoreProps) {
  const showSidebar = useChatStore((s) => s.showSidebar);
  const { sendMessage, retryMessage, cancelStream } = useChatStream();
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
  const hasBootstrappedStoreRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const restoredScrollBeforePaintRef = useRef(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const userScrolledUpRef = useRef(false);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const sessionId = useChatStore((s) => s.sessionId);
  const messages = useChatStore((s) => s.messages);

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

  const saveCurrentScrollPosition = useCallback(() => {
    const el = chatContainerRef.current;
    const sid = useChatStore.getState().sessionId;
    if (!el || !sid) return;

    try {
      sessionStorage.setItem(
        getChatScrollPositionKey(sid),
        JSON.stringify({
          top: el.scrollTop,
          distanceFromBottom: Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight),
        })
      );
    } catch {
      // ignore
    }
  }, []);

  useLayoutEffect(() => {
    return () => saveCurrentScrollPosition();
  }, [saveCurrentScrollPosition]);

  // Reset store before first paint to prevent stale cross-user data from showing
  useLayoutEffect(() => {
    if (hasBootstrappedStoreRef.current) {
      return;
    }
    hasBootstrappedStoreRef.current = true;

    const store = useChatStore.getState();

    if (userId && !isCacheOwnedBy(userId)) {
      clearAllChatCache();
      store.clearMessages();
      store.setSessionId(undefined);
      store.setSessions([]);
      return;
    }

    if (initialSessionId) {
      const hasCurrentSessionMessages =
        store.sessionId === initialSessionId &&
        store.messages.some((message) => message.id !== "init");
      if (hasCurrentSessionMessages) {
        return;
      }

      const cached = getCachedSessionMessages(initialSessionId);
      if (
        userId &&
        isCacheOwnedBy(userId) &&
        cached &&
        cached.messages.length > 0 &&
        !isCacheExpired(cached.savedAt)
      ) {
        store.setMessages(cached.messages);
        store.setSessionId(initialSessionId);
        return;
      }
    }

    store.clearMessages();
    store.setSessionId(undefined);
    store.setSessions([]);
  }, [initialSessionId, userId]);

  // Restore scroll before paint when returning from another route to an in-memory session.
  useLayoutEffect(() => {
    const el = chatContainerRef.current;
    const sid = initialSessionId ?? sessionId;
    if (!el || !sid || restoredScrollBeforePaintRef.current) return;

    const saved = readChatScrollPosition(sid);
    if (!saved) return;

    restoredScrollBeforePaintRef.current = true;
    isProgrammaticScrollRef.current = true;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = Math.min(maxTop, Math.max(0, el.scrollHeight - el.clientHeight - saved.distanceFromBottom, saved.top));
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
      userScrolledUpRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
    });
  }, [initialSessionId, messages, sessionId]);

  // Clear cross-user stale cache and store when user changes
  useEffect(() => {
    if (!userId) return;
    if (!isCacheOwnedBy(userId)) {
      clearAllChatCache();
      const store = useChatStore.getState();
      store.clearMessages();
      store.setSessionId(undefined);
      store.setSessions([]);
    }
  }, [userId]);

  // Cache write on unmount
  useEffect(() => {
    return () => {
      writeCache(userId);
    };
  }, [writeCache, userId]);

  // Track whether user has manually scrolled up
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      userScrolledUpRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
  }, []);

  const jumpToChatBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }, []);

  const animateToChatBottom = useCallback(
    (durationMs = 700) => {
      const el = chatContainerRef.current;
      if (!el) return;

      cancelScrollAnimation();

      const startTop = el.scrollTop;
      const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const distance = targetTop - startTop;

      if (Math.abs(distance) < 2) {
        el.scrollTop = targetTop;
        return;
      }

      const startedAt = performance.now();
      isProgrammaticScrollRef.current = true;
      userScrolledUpRef.current = false;

      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.scrollTop = startTop + distance * eased;

        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(step);
          return;
        }

        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
        scrollAnimationRef.current = null;
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
          userScrolledUpRef.current = false;
        });
      };

      scrollAnimationRef.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation]
  );

  useEffect(() => cancelScrollAnimation, [cancelScrollAnimation]);

  // Scroll to bottom on content changes; animate when entering/restoring a session.
  const prevMessagesLengthRef = useRef(0);
  const prevMessageIdsSignatureRef = useRef("");
  const prevSessionIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const nextSignature = messages.map((message) => message.id).join("|");
    const sessionChanged = sessionId !== prevSessionIdRef.current;
    const messageSetChanged = nextSignature !== prevMessageIdsSignatureRef.current;
    const isNewMessage = messages.length !== prevMessagesLengthRef.current;

    prevSessionIdRef.current = sessionId;
    prevMessagesLengthRef.current = messages.length;
    prevMessageIdsSignatureRef.current = nextSignature;

    if (sessionChanged || messageSetChanged || isNewMessage) {
      if (restoredScrollBeforePaintRef.current && !isNewMessage) {
        return;
      }
      userScrolledUpRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => animateToChatBottom());
      });
    } else if (!userScrolledUpRef.current && scrollAnimationRef.current === null) {
      jumpToChatBottom();
    }
  }, [animateToChatBottom, jumpToChatBottom, messages, sessionId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    (overrideText?: string, opts?: { startNewSession?: boolean }) => {
      const state = useChatStore.getState();

      // Block new sends while a response is streaming — user must stop first.
      if (state.isStreaming) return;

      const text = (overrideText ?? state.input).trim();
      const imageUrl = state.pendingImage?.url;

      if (!text && !imageUrl) return;

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

  const handleEdit = useCallback(
    (userMsgId: string, newContent: string) => {
      const state = useChatStore.getState();

      // Note: editing intentionally works even while streaming — retryMessage
      // aborts the active stream first, then regenerates from the edited message.
      const messages = state.messages;
      const userMsgIndex = messages.findIndex((m) => m.id === userMsgId);
      if (userMsgIndex === -1) return;

      // Update the edited user message content in-place
      const updatedMessages = messages.map((m, idx) =>
        idx === userMsgIndex ? { ...m, content: newContent } : m
      );

      // Regenerate the assistant reply that immediately follows this message
      const followingAssistant = updatedMessages
        .slice(userMsgIndex + 1)
        .find((m) => m.role === "agent");

      if (followingAssistant) {
        state.setMessages(updatedMessages);
        retryMessage(followingAssistant.id, newContent);
      } else {
        // No reply yet — append a fresh assistant placeholder and stream into it
        const assistantId = `a-${Date.now()}`;
        const placeholder: Message = {
          id: assistantId,
          role: "agent",
          content: "",
          isStreaming: true,
          toolCalls: [],
        };
        state.setMessages([...updatedMessages, placeholder]);
        retryMessage(assistantId, newContent);
      }
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
    // Clear ref so next recording doesn't carry stale text
    recordingTextRef.current = "";
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
          WiTH
        </div>
        <NotificationBell className="w-9 h-9" />
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex fixed inset-x-0 top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 justify-between items-center w-full px-16 h-20">
        <div className="flex items-center gap-4">
          <Icon name="spa" />
          <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
            WiTH
          </div>
        </div>
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
              onEdit={(userMsgId, newContent) => {
                markChatActivity();
                handleEdit(userMsgId, newContent);
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
            onCancel={() => {
              cancelStream();
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
