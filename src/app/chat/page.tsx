"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BottomNavBar } from "@/components/bottom-nav-bar";

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
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
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
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentAgentState, setCurrentAgentState] = useState<
    "idle" | "thinking" | "tools"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assistantAccRef = useRef("");

  // Auth check — redirect to login if not authenticated
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

  // Load sessions on mount
  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.sessions) setSessions(data.sessions);
      })
      .catch(console.error);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const startNewSession = useCallback(async () => {
    abortRef.current?.abort();
    setMessages([
      {
        id: "init",
        role: "agent",
        content:
          "欢迎回来。我是 Mindful，你的疗愈陪伴者。在这个当下，你感觉如何？",
      },
    ]);
    setSessionId(undefined);
    setError(null);
    setShowSidebar(false);
  }, []);

  const loadSession = useCallback(
    async (sid: string) => {
      abortRef.current?.abort();
      setSessionId(sid);
      setShowSidebar(false);
      setError(null);
      setIsStreaming(true);

      try {
        const res = await fetch(`/api/chat/sessions/${sid}/messages`);
        const data = await res.json();
        if (data.session?.messages) {
          setMessages(
            data.session.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role === "user" ? "user" : "agent",
              content: m.content,
            }))
          );
        }
      } catch (err) {
        console.error("Load session error:", err);
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: assistantId,
        role: "agent",
        content: "",
        isStreaming: true,
        toolCalls: [],
      },
    ]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "";
    setIsStreaming(true);
    setCurrentAgentState("thinking");
    setError(null);
    assistantAccRef.current = "";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
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
        if (sid) setSessionId(sid);
        break;
      }
      case "agent_start": {
        setCurrentAgentState("thinking");
        break;
      }
      case "turn_start": {
        setCurrentAgentState("thinking");
        break;
      }
      case "text_delta": {
        const delta = (event.delta as string) ?? "";
        assistantAccRef.current += delta;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantAccRef.current }
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
            return { ...m, toolCalls: [...existing, tool] };
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
        const msg = event.message as { role: string; text: string };
        if (msg.role === "assistant") {
          setCurrentAgentState("idle");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: msg.text, isStreaming: false }
                : m
            )
          );
        }
        break;
      }
      case "agent_end": {
        setCurrentAgentState("idle");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
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

  const lastMessage = messages[messages.length - 1];
  const lastAssistantEmpty =
    lastMessage?.role === "agent" &&
    lastMessage.content.trim().length === 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Mobile TopAppBar */}
      <header className="bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 md:hidden">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="flex items-center gap-2 text-on-surface-variant"
        >
          <span className="material-symbols-outlined">
            {showSidebar ? "close" : "menu"}
          </span>
        </button>
        <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
          Mindful
        </div>
        <button
          onClick={startNewSession}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-container text-primary hover:bg-primary-container/80 transition-colors"
          title="新建对话"
        >
          <span className="material-symbols-outlined text-xl">add</span>
        </button>
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 justify-between items-center w-full px-16 h-20">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-primary">spa</span>
          <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
            Mindful
          </div>
        </div>
        <nav className="flex gap-8 items-center h-full">
          <a
            href="/chat"
            className="text-primary font-bold h-full flex items-center border-b-2 border-primary"
          >
            Chat
          </a>
          <a
            href="/discover"
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Discover
          </a>
          <a
            href="/memory"
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Memory
          </a>
          <a
            href="/profile"
            className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent"
          >
            Profile
          </a>
        </nav>
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
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={startNewSession}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-primary bg-primary-container/40 hover:bg-primary-container/60 transition-colors"
            >
              <span className="material-symbols-outlined">add</span>
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
                <div className="text-sm font-medium truncate">
                  {s.title}
                </div>
                <div className="text-xs mt-0.5 opacity-60 truncate">
                  {s.lastMessage ?? `${s.messageCount} 条消息`}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col max-w-[800px] mx-auto w-full overflow-hidden relative z-10 pb-24 md:pb-8 pt-6">
          {/* Date Header */}
          <div className="text-center mb-8">
            <span className="text-on-surface-variant/70 text-xs uppercase tracking-widest">
              今天
            </span>
          </div>

          {/* Chat History */}
          <div
            ref={chatContainerRef}
            className="flex-1 w-full px-6 md:px-6 overflow-y-auto no-scrollbar flex flex-col gap-6"
          >
            {messages.map((msg, index) =>
              msg.role === "agent" ? (
                msg.content.trim().length === 0 && msg.isStreaming ? (
                  <AgentThinkingBubble
                    key={msg.id}
                    state={currentAgentState}
                    toolCalls={msg.toolCalls}
                  />
                ) : (
                  <AgentBubble
                    key={msg.id}
                    message={msg}
                    index={index}
                  />
                )
              ) : (
                <UserBubble key={msg.id} message={msg} index={index} />
              )
            )}

            {error && (
              <div className="flex w-full justify-center">
                <div className="bg-error-container text-on-error-container rounded-2xl px-4 py-2 text-sm">
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="w-full px-6 md:px-6 mt-auto pt-6 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0 z-20">
            <div className="relative bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[32px] shadow-[0_20px_40px_rgba(45,45,45,0.04)] flex items-end p-2 transition-all focus-within:border-secondary/50 focus-within:bg-surface/80">
              <button
                className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-secondary transition-colors hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="分享你的感受..."
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-on-surface text-base placeholder-on-surface-variant/50 max-h-[120px] overflow-y-auto no-scrollbar"
                style={{ minHeight: "48px" }}
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || input.trim().length === 0}
                className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center bg-secondary text-on-secondary hover:opacity-90 transition-opacity ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">
                  {isStreaming ? "more_horiz" : "send"}
                </span>
              </button>
            </div>
          </div>
        </main>
      </div>

      <BottomNavBar />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble Components
// ---------------------------------------------------------------------------

function AgentBubble({
  message,
  index,
}: {
  message: Message;
  index: number;
}) {
  return (
    <div
      className="flex w-full justify-start chat-bubble-enter"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex gap-4 max-w-[85%] md:max-w-[70%]">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 border border-outline-variant/20 shadow-[0_4px_12px_rgba(45,45,45,0.02)]">
          <span
            className="material-symbols-outlined text-tertiary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            spa
          </span>
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="bg-surface-container-low rounded-t-[24px] rounded-br-[24px] rounded-bl-[4px] p-5 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 text-on-surface text-base">
            {message.content ? (
              <MarkdownContent text={message.content} />
            ) : (
              <span className="text-on-surface-variant/50 italic">
                正在思考...
              </span>
            )}
          </div>
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallIndicators tools={message.toolCalls} />
          )}
        </div>
      </div>
    </div>
  );
}

function UserBubble({
  message,
  index,
}: {
  message: Message;
  index: number;
}) {
  return (
    <div
      className="flex w-full justify-end chat-bubble-enter"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex gap-4 max-w-[85%] md:max-w-[70%] flex-row-reverse">
        <div className="bg-primary-container rounded-t-[24px] rounded-bl-[24px] rounded-br-[4px] p-5 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 text-on-surface text-base">
          <MarkdownContent text={message.content} />
        </div>
      </div>
    </div>
  );
}

function AgentThinkingBubble({
  state,
  toolCalls,
}: {
  state: "idle" | "thinking" | "tools";
  toolCalls?: ToolCallInfo[];
}) {
  const runningTools = toolCalls?.filter((t) => t.status === "running") ?? [];

  return (
    <div className="flex w-full justify-start chat-bubble-enter">
      <div className="flex gap-4 max-w-[85%] md:max-w-[70%]">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 border border-outline-variant/20 shadow-[0_4px_12px_rgba(45,45,45,0.02)]">
          <span
            className="material-symbols-outlined text-tertiary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            spa
          </span>
        </div>
        <div className="bg-surface-container-low rounded-[24px] px-5 py-4 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 flex flex-col gap-2">
          {state === "thinking" && (
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <div className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
              <span>正在思考...</span>
            </div>
          )}
          {state === "tools" && runningTools.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {runningTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center gap-2 text-on-surface-variant text-sm"
                >
                  <div className="w-4 h-4 border-2 border-tertiary/30 border-t-tertiary rounded-full animate-spin" />
                  <span>正在使用 {tool.label}...</span>
                </div>
              ))}
            </div>
          )}
          {state === "idle" && (
            <div className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full bg-outline-variant animate-bounce"
                style={{ animationDelay: "0s" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-outline-variant animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="w-2 h-2 rounded-full bg-outline-variant animate-bounce"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolCallIndicators({ tools }: { tools: ToolCallInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 ml-14">
      {tools.map((tool) => (
        <span
          key={tool.id}
          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
            tool.status === "running"
              ? "bg-tertiary-container/40 border-tertiary/20 text-on-tertiary-container"
              : tool.status === "error"
              ? "bg-error-container/40 border-error/20 text-on-error-container"
              : "bg-surface-container-high border-outline-variant/20 text-on-surface-variant"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {tool.status === "running"
              ? "sync"
              : tool.status === "error"
              ? "error"
              : "check_circle"}
          </span>
          {tool.label}
        </span>
      ))}
    </div>
  );
}
