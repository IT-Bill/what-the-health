"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import type { ChatWireMessage } from "../api/chat/route";

interface Message {
  id: string;
  role: "agent" | "user";
  content: string[];
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "agent",
    content: ["欢迎回来。在这个当下，你感觉如何？"],
  },
];

// Split streamed plain text into paragraphs on blank lines for nicer bubbles.
function toParagraphs(text: string): string[] {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

// Map the local UI messages to the wire format the API route expects.
function toWireMessages(messages: Message[]): ChatWireMessage[] {
  return messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    text: m.content.join("\n\n"),
  }));
}

export default function ChatPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Abort any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: [text],
    };
    const assistantId = `a-${Date.now()}`;

    // Append the user message + an empty assistant placeholder we'll fill in.
    const history = [...messages, userMessage];
    setMessages([...history, { id: assistantId, role: "agent", content: [""] }]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toWireMessages(history) }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `请求失败 (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const paragraphs = toParagraphs(acc);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: paragraphs } : m
          )
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User navigated away or cancelled — leave partial content as-is.
      } else {
        const msg = err instanceof Error ? err.message : "连接出错，请稍后再试。";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: [`⚠️ ${msg}`] } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
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

  // While streaming, the last message is the assistant placeholder. The typing
  // dots show until its first token arrives.
  const lastMessage = messages[messages.length - 1];
  const lastAssistantEmpty =
    lastMessage?.role === "agent" &&
    lastMessage.content.join("").trim().length === 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Mobile TopAppBar */}
      <header className="bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 md:hidden">
        <div className="flex items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined">spa</span>
        </div>
        <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
          Mindful Moments
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmyCHplBlEA2-ZY6mgFEDrgRJ4Xv330ovvOFWyDVcQyw3t1Y-q7dnDUWTnCAj9LHcJSwNa8dQmf2SCyG_cjDH672FSCeKg220a9VKBaPcJUn87sn-Z-d0SRordKn5rEFHXkhvftCc4P_EWPw0cmQ0mrPRfCdmMXavLoBXmZBHd3CVXXbxsk39pC_AvELDbmgWnzTGmkoOxBhYhyUJQiOkPJ7944vuEsZpbwpAysFRiF3gtrYLYQOI_5LEOLU4T_MPBV4PjTf_-9dQ"
            alt="User avatar"
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30 justify-between items-center w-full px-16 h-20">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-primary">spa</span>
          <div className="font-[var(--font-display)] text-2xl font-medium text-primary">
            Mindful Moments
          </div>
        </div>
        <nav className="flex gap-8 items-center h-full">
          <a href="/chat" className="text-primary font-bold h-full flex items-center border-b-2 border-primary">Chat</a>
          <a href="/discover" className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Discover</a>
          <a href="/memory" className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Memory</a>
          <a href="/profile" className="text-on-surface-variant hover:opacity-80 transition-opacity h-full flex items-center border-b-2 border-transparent">Profile</a>
        </nav>
      </header>

      {/* Main Chat Canvas */}
      <main className="flex-grow flex flex-col items-center w-full max-w-[800px] mx-auto overflow-hidden relative z-10 pb-24 md:pb-8 pt-6">
        {/* Date Header */}
        <div className="text-center mb-8">
          <span className="text-on-surface-variant/70 text-xs uppercase tracking-widest">
            今天
          </span>
        </div>

        {/* Chat History */}
        <div
          ref={chatContainerRef}
          className="flex-grow w-full px-6 md:px-6 overflow-y-auto no-scrollbar flex flex-col gap-6"
        >
          {messages.map((msg, index) =>
            msg.role === "agent" ? (
              // Skip the empty placeholder; the typing indicator stands in for it.
              msg.content.join("").trim().length === 0 ? null : (
                <AgentBubble key={msg.id} message={msg} index={index} />
              )
            ) : (
              <UserBubble key={msg.id} message={msg} index={index} />
            )
          )}

          {/* Typing Indicator — shown while waiting for the first token */}
          {isStreaming && lastAssistantEmpty && (
            <div className="flex w-full justify-start chat-bubble-enter">
              <div className="flex gap-4 max-w-[85%] md:max-w-[70%]">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 mt-auto border border-outline-variant/20 shadow-[0_4px_12px_rgba(45,45,45,0.02)]">
                  <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                </div>
                <div className="bg-surface-container-low rounded-[24px] px-5 py-4 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-outline-variant animate-bounce" style={{ animationDelay: "0s" }} />
                  <div className="w-2 h-2 rounded-full bg-outline-variant animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <div className="w-2 h-2 rounded-full bg-outline-variant animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="w-full px-6 md:px-6 mt-auto pt-6 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0 z-20">
          <div className="relative bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[32px] shadow-[0_20px_40px_rgba(45,45,45,0.04)] flex items-end p-2 transition-all focus-within:border-secondary/50 focus-within:bg-surface/80">
            <button className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-secondary transition-colors hover:bg-surface-container-low">
              <span className="material-symbols-outlined">mic</span>
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

      {/* Bottom Nav (Mobile) */}
      <BottomNavBar />
    </div>
  );
}

function AgentBubble({ message, index }: { message: Message; index: number }) {
  return (
    <div className="flex w-full justify-start chat-bubble-enter" style={{ animationDelay: `${index * 0.3}s` }}>
      <div className="flex gap-4 max-w-[85%] md:max-w-[70%]">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 mt-auto border border-outline-variant/20 shadow-[0_4px_12px_rgba(45,45,45,0.02)]">
          <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
        </div>
        <div className="bg-surface-container-low rounded-t-[24px] rounded-br-[24px] rounded-bl-[4px] p-5 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 text-on-surface text-base">
          {message.content.map((paragraph, i) => (
            <p key={i} className={`leading-relaxed ${i > 0 ? "mt-4" : ""}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ message, index }: { message: Message; index: number }) {
  return (
    <div className="flex w-full justify-end chat-bubble-enter" style={{ animationDelay: `${index * 0.3}s` }}>
      <div className="flex gap-4 max-w-[85%] md:max-w-[70%] flex-row-reverse">
        <div className="bg-primary-container rounded-t-[24px] rounded-bl-[24px] rounded-br-[4px] p-5 shadow-[0_8px_24px_rgba(45,45,45,0.03)] border border-outline-variant/10 text-on-surface text-base">
          {message.content.map((paragraph, i) => (
            <p key={i} className={`leading-relaxed ${i > 0 ? "mt-4" : ""}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
