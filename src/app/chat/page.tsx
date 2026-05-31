"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Camera, Image, FileText, CircleCheck, CircleX } from "lucide-react";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import {
  CHAT_CACHED_SESSION_KEY,
  CHAT_HAS_ACTIVITY_KEY,
  CHAT_RESTORE_LATEST_KEY,
  PENDING_VOICE_TEXT_KEY,
  VOICE_SUBMIT_EVENT,
  type PendingVoiceText,
  type VoiceSubmitEventDetail,
} from "@/lib/voice-events";
import { Icon } from "@/components/icon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  lastMessage: string | null;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  reasoning?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
  preToolText?: string;
  turnCount?: number;
}

interface ToolCallInfo {
  id: string;
  name: string;
  label: string;
  status: "running" | "done" | "error";
  result?: string;
}

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

interface CachedChatSessionPayload {
  sessionId?: string;
  messages: Message[];
  savedAt: number;
}

function normalizeCachedMessages(messages: Message[]) {
  return messages
    .filter((message) => message.id !== "init")
    .map((message) => ({ ...message, isStreaming: false }));
}

function coerceCachedMessage(value: unknown): Message | null {
  if (!value || typeof value !== "object") return null;

  const message = value as Partial<Message>;
  if (message.role !== "user" && message.role !== "agent") return null;
  if (typeof message.id !== "string" || typeof message.content !== "string") {
    return null;
  }

  return {
    ...message,
    id: message.id,
    role: message.role,
    content: message.content,
    isStreaming: false,
  };
}

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="leading-relaxed">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-on-surface">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-on-surface-variant">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-sm font-mono text-on-surface">
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-surface-container-high rounded-xl p-4 overflow-x-auto my-3">
              <code className="text-sm font-mono text-on-surface">
                {children}
              </code>
            </pre>
          );
        },
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 text-on-surface">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2 text-on-surface">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-bold mt-2 mb-1 text-on-surface">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-secondary/40 pl-4 italic text-on-surface-variant my-3">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-outline-variant/30 my-4" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "agent",
      content:
        "欢迎回来。我是 Mindful，你的疗愈陪伴者。在这个当下，你感觉如何？",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSessionBootstrapDone, setIsSessionBootstrapDone] = useState(false);
  const [pendingVoiceText, setPendingVoiceText] = useState<PendingVoiceText | null>(null);
  const hadPendingVoiceOnMountRef = useRef(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentAgentState, setCurrentAgentState] = useState<
    "idle" | "thinking" | "tools"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);


  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>(messages);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const abortRef = useRef<AbortController | null>(null);
  const assistantAccRef = useRef("");
  const reasoningAccRef = useRef("");
  const thinkingStartRef = useRef<number>(0);

  // Voice recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTextRef = useRef("");
  const [volumeBars, setVolumeBars] = useState<number[]>(Array(20).fill(0.15));

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Auth check
  useEffect(() => {
    fetch("/api/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  const queueVoiceText = useCallback(
    (text: string | null | undefined, startNewSession = false) => {
      const trimmed = text?.trim();
      if (trimmed) setPendingVoiceText({ text: trimmed, startNewSession });
    },
    []
  );

  const readPendingVoiceText = useCallback((): PendingVoiceText | null => {
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
  }, []);

  const markChatActivity = useCallback(() => {
    sessionStorage.setItem(CHAT_HAS_ACTIVITY_KEY, "1");
  }, []);

  const markRestoreLatestOnReturn = useCallback(() => {
    if (sessionStorage.getItem(CHAT_HAS_ACTIVITY_KEY) === "1") {
      sessionStorage.setItem(CHAT_RESTORE_LATEST_KEY, "1");
    }
  }, []);

  const writeCachedChatSession = useCallback(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(CHAT_HAS_ACTIVITY_KEY) !== "1") return;
    if (isStreamingRef.current) return;

    const cachedMessages = normalizeCachedMessages(messagesRef.current);
    if (cachedMessages.length === 0) return;

    const payload: CachedChatSessionPayload = {
      sessionId: sessionIdRef.current,
      messages: cachedMessages,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(CHAT_CACHED_SESSION_KEY, JSON.stringify(payload));
  }, []);

  const readCachedChatSession = useCallback((): CachedChatSessionPayload | null => {
    const raw = sessionStorage.getItem(CHAT_CACHED_SESSION_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<CachedChatSessionPayload>;
      const messages = Array.isArray(parsed.messages)
        ? parsed.messages.map(coerceCachedMessage).filter((m): m is Message => m !== null)
        : [];

      if (messages.length === 0) return null;

      return {
        sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
        messages,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      };
    } catch {
      sessionStorage.removeItem(CHAT_CACHED_SESSION_KEY);
      return null;
    }
  }, []);

  const hydrateCachedChatSession = useCallback(() => {
    const cached = readCachedChatSession();
    if (!cached) return false;

    sessionIdRef.current = cached.sessionId;
    messagesRef.current = cached.messages;
    setSessionId(cached.sessionId);
    setMessages(cached.messages);
    return true;
  }, [readCachedChatSession]);

  const prepareRestoreLatestOnReturn = useCallback(() => {
    writeCachedChatSession();
    markRestoreLatestOnReturn();
  }, [markRestoreLatestOnReturn, writeCachedChatSession]);

  useEffect(() => () => writeCachedChatSession(), [writeCachedChatSession]);

  // Queue voice message from BottomNavBar navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingVoiceText = readPendingVoiceText();
    if (pendingVoiceText) {
      hadPendingVoiceOnMountRef.current = true;
      sessionStorage.removeItem(PENDING_VOICE_TEXT_KEY);
      queueMicrotask(() =>
        queueVoiceText(pendingVoiceText.text, pendingVoiceText.startNewSession === true)
      );
      return;
    }

    // Backward compatibility for old /chat?voice=... links.
    const params = new URLSearchParams(window.location.search);
    const voiceText = params.get("voice");
    if (!voiceText) return;

    hadPendingVoiceOnMountRef.current = true;
    queueMicrotask(() => queueVoiceText(voiceText, true));
    params.delete("voice");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [queueVoiceText, readPendingVoiceText]);

  // Queue voice message when the center nav button is used while already on /chat.
  useEffect(() => {
    const handleVoiceSubmit = (event: Event) => {
      const detail = (event as CustomEvent<VoiceSubmitEventDetail>).detail;
      queueVoiceText(detail?.text, detail?.startNewSession === true);
    };

    window.addEventListener(VOICE_SUBMIT_EVENT, handleVoiceSubmit);
    return () => window.removeEventListener(VOICE_SUBMIT_EVENT, handleVoiceSubmit);
  }, [queueVoiceText]);

  // Render the last chat instantly on return, then let the database fetch refresh it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldRestoreLatest =
      sessionStorage.getItem(CHAT_RESTORE_LATEST_KEY) === "1" &&
      !hadPendingVoiceOnMountRef.current;
    if (!shouldRestoreLatest) return;

    queueMicrotask(() => {
      if (!hadPendingVoiceOnMountRef.current) hydrateCachedChatSession();
    });
  }, [hydrateCachedChatSession]);

  const startNewSession = useCallback(async () => {
    abortRef.current?.abort();
    const initialMessages: Message[] = [
      {
        id: "init",
        role: "agent",
        content:
          "欢迎回来。我是 Mindful，你的疗愈陪伴者。在这个当下，你感觉如何？",
      },
    ];
    messagesRef.current = initialMessages;
    sessionIdRef.current = undefined;
    sessionStorage.removeItem(CHAT_CACHED_SESSION_KEY);
    setMessages(initialMessages);
    setSessionId(undefined);
    setError(null);
    setShowSidebar(false);
  }, []);

  const loadSession = useCallback(async (sid: string) => {
    abortRef.current?.abort();
    setSessionId(sid);
    setShowSidebar(false);
    setError(null);
    isStreamingRef.current = true;
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/chat/sessions/${sid}/messages`);
      const data = await res.json();
      if (data.session?.messages) {
        const nextMessages: Message[] = data.session.messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            toolCallsJson?: string;
          }) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "agent",
            content: m.content,
            toolCalls: m.toolCallsJson ? JSON.parse(m.toolCallsJson) : undefined,
          })
        );
        messagesRef.current = nextMessages;
        sessionIdRef.current = sid;
        setMessages(nextMessages);
      }
    } catch (err) {
      console.error("Load session error:", err);
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, []);

  // Load sessions on mount before auto-submitting queued voice text.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialSessions() {
      try {
        const r = await fetch("/api/chat/sessions");
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        if (data?.sessions) {
          setSessions(data.sessions);
          const shouldRestoreLatest =
            sessionStorage.getItem(CHAT_RESTORE_LATEST_KEY) === "1" &&
            !hadPendingVoiceOnMountRef.current;

          if (shouldRestoreLatest && data.sessions.length > 0) {
            await loadSession(data.sessions[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsSessionBootstrapDone(true);
      }
    }

    loadInitialSessions();

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  useEffect(() => {
    if (!pendingVoiceText || !isSessionBootstrapDone || isStreamingRef.current || isStreaming) {
      return;
    }

    const { text, startNewSession } = pendingVoiceText;
    setPendingVoiceText(null);
    void handleSend(text, { startNewSession });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceText, isSessionBootstrapDone, isStreaming]);

  async function handleSend(
    overrideText?: string,
    options: { startNewSession?: boolean } = {}
  ) {
    const text = (overrideText ?? input).trim();
    if (!text || isStreamingRef.current) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantId = `a-${Date.now()}`;

    const assistantMsg: Message = {
      id: assistantId,
      role: "agent",
      content: "",
      isStreaming: true,
      toolCalls: [],
    };

    markChatActivity();
    const nextMessages = options.startNewSession
      ? [userMsg, assistantMsg]
      : [...messagesRef.current, userMsg, assistantMsg];
    messagesRef.current = nextMessages;
    if (options.startNewSession) {
      sessionIdRef.current = undefined;
      setSessionId(undefined);
    }
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "";
    isStreamingRef.current = true;
    setIsStreaming(true);
    setCurrentAgentState("thinking");
    setError(null);
    assistantAccRef.current = "";
    reasoningAccRef.current = "";
    thinkingStartRef.current = Date.now();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: options.startNewSession ? undefined : sessionId,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `请求失败 (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as SseEvent;
            processSseEvent(event, assistantId);
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
      } else {
        const msg =
          err instanceof Error ? err.message : "连接出错，请稍后再试。";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${msg}`, isStreaming: false }
              : m
          )
        );
      }
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
      setCurrentAgentState("idle");
      abortRef.current = null;

      // Refresh sessions list
      fetch("/api/chat/sessions")
        .then((r) => r.json())
        .then((data) => {
          if (data.sessions) setSessions(data.sessions);
        })
        .catch(console.error);
    }
  }

  function processSseEvent(event: SseEvent, assistantId: string) {
    switch (event.type) {
      case "session": {
        const sid = event.sessionId as string;
        if (sid) {
          sessionIdRef.current = sid;
          setSessionId(sid);
        }
        break;
      }
      case "agent_start": {
        setCurrentAgentState("thinking");
        thinkingStartRef.current = Date.now();
        break;
      }
      case "turn_end": {
        const tc = (event.turnCount as number) ?? 0;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, turnCount: tc } : m)
        );
        break;
      }
      case "text_delta": {
        const delta = (event.delta as string) ?? "";
        assistantAccRef.current += delta;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantAccRef.current } : m
          )
        );
        break;
      }
      case "reasoning_delta": {
        const delta = (event.delta as string) ?? "";
        reasoningAccRef.current += delta;
        const duration = thinkingStartRef.current
          ? Math.round((Date.now() - thinkingStartRef.current) / 1000)
          : 0;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, reasoning: reasoningAccRef.current, thinkingDuration: duration }
              : m
          )
        );
        break;
      }
      case "tool_start": {
        setCurrentAgentState("tools");
        const tool = event.tool as ToolCallInfo;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const existing = m.toolCalls ?? [];
            if (existing.find((t) => t.id === tool.id)) return m;
            // Move any pre-tool text into preToolText and clear content
            const preToolText = (m.preToolText ?? "") + (assistantAccRef.current.trim() ? assistantAccRef.current : "");
            assistantAccRef.current = "";
            return { ...m, toolCalls: [...existing, tool], preToolText, content: "" };
          })
        );
        break;
      }
      case "tool_end": {
        const tool = event.tool as ToolCallInfo;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const updated = (m.toolCalls ?? []).map((t) =>
              t.id === tool.id ? tool : t
            );
            return { ...m, toolCalls: updated };
          })
        );
        break;
      }
      case "message_end": {
        // Don't update content here — wait for agent_end to show everything at once
        const msg = event.message as { role: string; text: string };
        if (msg.role === "assistant") {
          setCurrentAgentState("idle");
        }
        break;
      }
      case "agent_end": {
        setCurrentAgentState("idle");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantAccRef.current, isStreaming: false }
              : m
          )
        );
        break;
      }
      case "error": {
        const msg = (event.message as string) ?? "未知错误";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${msg}`, isStreaming: false }
              : m
          )
        );
        break;
      }
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ---------------------------------------------------------------------------
  // Voice Recording
  // ---------------------------------------------------------------------------

  async function startVoiceRecording() {
    if (isRecording) return;
    cleanupRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      audioChunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(data));
        // Update waveform bars
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        setVolumeBars(prev => {
          const next = [...prev.slice(1), Math.min(1, rms * 8 + 0.05)];
          return next;
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const wsUrl = isDev ? `ws://localhost:3001` : `wss://${window.location.host}/api/asr`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", language: "zh-CN" }));

        // Only start sending audio after the session is started
        sendIntervalRef.current = setInterval(() => {
          const chunks = audioChunksRef.current.splice(0);
          if (chunks.length === 0 || ws.readyState !== WebSocket.OPEN) return;

          const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

          const int16Data = new Int16Array(merged.length);
          for (let i = 0; i < merged.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, merged[i] * 32767));
          }
          ws.send(int16Data.buffer);
        }, 200);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "result" && msg.text) {
            recordingTextRef.current = msg.text;
          } else if (msg.type === "error") {
            console.error("[ASR] Error:", msg.message);
          }
        } catch {
          // ignore non-JSON
        }
      };

      ws.onerror = () => {
        console.error("[ASR] WebSocket connection failed — is the proxy running? (pnpm asr-proxy)");
        cleanupRecording();
        setIsRecording(false);
        alert("语音服务连接失败，请确保已运行 pnpm asr-proxy");
      };

      ws.onclose = () => {
        cleanupRecording();
      };

      setIsRecording(true);
      recordingTextRef.current = "";
    } catch (err) {
      console.error("[Voice] Failed to start recording:", err);
      alert("无法启动录音，请检查麦克风权限");
    }
  }

  function cleanupRecording() {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    }
  }

  function stopVoiceRecording() {
    if (!isRecording) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const chunks = audioChunksRef.current.splice(0);
      if (chunks.length > 0) {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        const int16Data = new Int16Array(merged.length);
        for (let i = 0; i < merged.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, merged[i] * 32767));
        }
        ws.send(int16Data.buffer);
      }
      ws.send(JSON.stringify({ type: "end" }));
    }

    cleanupRecording();
    setIsRecording(false);

    const text = recordingTextRef.current.trim();
    if (text) {
      queueVoiceText(text);
    }

    recordingTextRef.current = "";
  }

  const hasInput = input.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Mobile TopAppBar */}
      <header className="bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 md:hidden">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="flex items-center gap-2 text-on-surface-variant"
        >
          <Icon name={showSidebar ? "close" : "menu"} />
        </button>
        <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
          Mindful
        </div>
        <a
          href="/notifications"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-container text-primary hover:bg-primary-container/80 transition-colors"
          title="通知中心"
          aria-label="通知中心"
        >
          <Icon name="notifications" />
        </a>
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 justify-between items-center w-full px-16 h-20">
        <div className="flex items-center gap-4">
          <Icon name="spa" />
          <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
            Mindful
          </div>
        </div>
        <nav className="flex gap-8 items-center h-full">
          <Link href="/chat" className="text-primary font-bold h-full flex items-center border-b-2 border-primary">Chat</Link>
          <Link href="/discover" onClick={prepareRestoreLatestOnReturn} className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Discover</Link>
          <Link href="/memory" onClick={prepareRestoreLatestOnReturn} className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Memory</Link>
          <Link href="/profile" onClick={prepareRestoreLatestOnReturn} className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Profile</Link>
        </nav>
        <a
          href="/notifications"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-container text-primary hover:bg-primary-container/80 transition-colors"
          title="通知中心"
          aria-label="通知中心"
        >
          <Icon name="notifications" />
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
              ? "fixed top-0 left-0 h-full w-5/6 z-40 bg-surface/95 backdrop-blur-xl flex flex-col md:relative md:inset-auto md:w-72 md:bg-transparent md:backdrop-blur-none"
              : "hidden md:flex md:w-72 md:flex-col"
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
              onClick={startNewSession}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-primary bg-primary-container/40 hover:bg-primary-container/60 transition-colors"
            >
              <Icon name="add" />
              <span className="text-sm font-medium">新建对话</span>
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-colors ${
                  sessionId === s.id
                    ? "bg-secondary-container/60 text-on-secondary-container"
                    : "hover:bg-surface-container-high/60 text-on-surface-variant"
                }`}
              >
                <div className="text-sm font-medium truncate">{s.title}</div>
                <div className="text-xs mt-0.5 opacity-60 truncate">
                  {s.lastMessage ?? `${s.messageCount} 条消息`}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col max-w-[800px] mx-auto w-full overflow-hidden relative z-10 pb-40 md:pb-8">
          {/* Chat History */}
          <div
            ref={chatContainerRef}
            className="flex-1 w-full px-4 md:px-6 overflow-y-auto no-scrollbar flex flex-col gap-1 pt-4"
          >
            {/* Welcome screen — only when explicitly in new session state */}
            {sessionId === undefined && messages[0]?.id === "init" && !isStreaming && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 gap-6">
                <h1 className="text-3xl font-medium text-on-surface tracking-tight">
                  在这个当下，你感觉如何？
                </h1>
                <div className="flex justify-center gap-2">
                  {[
                    { icon: "self_improvement", label: "帮我放松" },
                    { icon: "edit_note", label: "写日记" },
                    { icon: "psychology", label: "倾诉烦恼" },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.label)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high transition-colors text-xs text-on-surface-variant"
                    >
                      <Icon name={s.icon} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {(sessionId !== undefined || messages[0]?.id !== "init" || isStreaming) && (
              <>
                {messages.map((msg) =>
                  msg.role === "agent" ? (
                    msg.isStreaming && (!msg.content || (msg.toolCalls ?? []).some((t) => t.status === "running")) ? (
                      <AgentThinkingState
                        key={msg.id}
                        state={currentAgentState}
                        toolCalls={msg.toolCalls}
                      />
                    ) : (
                      <AgentMessage
                        key={msg.id}
                        message={msg}
                      />
                    )
                  ) : (
                    <UserBubble key={msg.id} message={msg} />
                  )
                )}
              </>
            )}

            {error && (
              <div className="flex w-full justify-center py-2">
                <div className="bg-error-container text-on-error-container rounded-2xl px-4 py-2 text-sm">
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="fixed bottom-[84px] left-0 right-0 z-[55] bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-2 px-4 md:sticky md:bottom-0">
            <div className="max-w-[800px] mx-auto">
              <div className="relative flex items-end gap-2 bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[28px] shadow-[0_12px_32px_rgba(45,45,45,0.04)] px-2 py-1.5">
                {/* Attachment / Cancel Button */}
                <button
                  onClick={isRecording ? () => { cleanupRecording(); setIsRecording(false); recordingTextRef.current = ""; } : () => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  <Icon name="add" className="text-2xl transition-transform duration-300" />
                </button>

                {/* Textarea or Waveform */}
                {isRecording ? (
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

                {/* Voice / Send Button */}
                {hasInput && !isRecording ? (
                  <button
                    onClick={() => handleSend()}
                    disabled={isStreaming}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-on-surface text-surface hover:opacity-90 transition-all disabled:opacity-40"
                  >
                    <Icon name="arrow_upward" />
                  </button>
                ) : (
                  <button
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    disabled={isStreaming}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isRecording ? "bg-error text-on-error" : "text-on-surface-variant hover:bg-surface-container-low"
                    } disabled:opacity-40`}
                  >
                    <Icon name={isRecording ? "stop" : "mic_none"} size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
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
                { icon: Camera, label: "相机" },
                { icon: Image, label: "照片" },
                { icon: FileText, label: "文件" },
              ].map((item) => (
                <button
                  key={item.label}
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

      <BottomNavBar />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Components
// ---------------------------------------------------------------------------

function AgentMessage({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const toolCount = message.toolCalls?.length ?? 0;
  const turns = message.turnCount ?? 0;
  const hasThinking = toolCount > 0 || turns > 0 || !!message.preToolText || !!message.reasoning;

  const summaryParts: string[] = [];
  if (toolCount > 0) summaryParts.push(`${toolCount} 次工具调用`);
  if (turns > 0) summaryParts.push(`思考 ${turns} 轮`);
  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "思考已完成";

  return (
    <div className="w-full py-3">
      {hasThinking && (
        <div className="mb-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-on-surface-variant/60 hover:text-on-surface-variant transition-colors text-sm"
          >
            <Icon name="key" />
            <span>{summary}</span>
            <Icon name="expand_more" className="text-base" />
          </button>
          {expanded && (
            <div className="mt-2 pl-5 border-l-2 border-outline-variant/30 text-on-surface-variant/70 text-sm leading-relaxed space-y-2">
              {(message.preToolText || message.reasoning) && (
                <p className="italic">{message.preToolText ?? message.reasoning}</p>
              )}
              {message.toolCalls?.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  {t.status === "error"
                    ? <CircleX className="w-3.5 h-3.5 shrink-0 text-error" />
                    : <CircleCheck className="w-3.5 h-3.5 shrink-0 text-on-surface-variant/70" />
                  }
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="text-on-surface text-base leading-relaxed">
        <MarkdownContent text={message.content} />
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40"
          style={{
            animation: "thinking-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

function AgentThinkingState({
  state,
  toolCalls,
}: {
  state: "idle" | "thinking" | "tools";
  toolCalls?: ToolCallInfo[];
}) {
  const [expanded, setExpanded] = useState(false);
  const doneTools = toolCalls?.filter((t) => t.status !== "running") ?? [];
  const runningTool = toolCalls?.find((t) => t.status === "running");
  const isWorking = state === "thinking" || state === "tools" || !!runningTool;

  return (
    <div className="w-full py-3">
      {/* Collapsible thinking/tool section */}
      {doneTools.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-on-surface-variant/60 hover:text-on-surface-variant transition-colors text-sm"
          >
            <Icon name="key" />
            <span>{doneTools.length} 次工具调用</span>
            <Icon name="expand_more" className="text-base" />
          </button>
          {expanded && (
            <div className="mt-2 pl-5 border-l-2 border-outline-variant/30 text-on-surface-variant/70 text-sm space-y-1.5">
              {doneTools.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  {t.status === "error"
                    ? <CircleX className="w-3.5 h-3.5 shrink-0 text-error" />
                    : <CircleCheck className="w-3.5 h-3.5 shrink-0 text-on-surface-variant/70" />
                  }
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running tool label */}
      {runningTool && (
        <div className="text-on-surface-variant/50 text-xs mb-1.5">
          正在使用 {runningTool.label}...
        </div>
      )}

      {/* Dots — shown whenever agent is still working */}
      {isWorking && <ThinkingDots />}
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex w-full justify-end py-2">
      <div className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5 max-w-[85%] md:max-w-[70%]">
        <p className="text-on-surface text-base leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
