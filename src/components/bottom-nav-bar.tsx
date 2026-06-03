"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  CHAT_HAS_ACTIVITY_KEY,
  CHAT_RESTORE_LATEST_KEY,
  PENDING_VOICE_TEXT_KEY,
  VOICE_SUBMIT_EVENT,
  type VoiceSubmitEventDetail,
  type PendingVoiceText,
} from "@/lib/voice-events";
import { getAsrWebSocketUrl, getVoiceUnavailableMessage } from "@/lib/voice-client";
import { Icon } from "./icon";
import { Mic } from "lucide-react";

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/chat", icon: "chat_bubble", label: "Chat" },
  { href: "/discover", icon: "explore", label: "Discover" },
  // Center voice button is rendered separately
  { href: "/memory", icon: "auto_stories", label: "Memory" },
  { href: "/profile", icon: "person", label: "Profile" },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [volumeBars, setVolumeBars] = useState<number[]>(Array(5).fill(0.15));

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  const shouldSendRef = useRef(false);

  // ASR refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");

  const markChatRestoreIntent = useCallback(() => {
    if (pathname === "/chat" && sessionStorage.getItem(CHAT_HAS_ACTIVITY_KEY) === "1") {
      sessionStorage.setItem(CHAT_RESTORE_LATEST_KEY, "1");
    }
  }, [pathname]);

  const handleChatNavClick = useCallback((e: React.MouseEvent) => {
    if (pathname === "/chat" || pathname?.startsWith("/chat/")) return; // Already on chat page
    const latestId = sessionStorage.getItem("wth:latest-chat-session-id");
    if (latestId) {
      e.preventDefault();
      router.push(`/chat/${latestId}`);
    }
  }, [pathname, router]);

  const submitVoiceText = useCallback((text: string) => {
    if (pathname === "/chat" || pathname?.startsWith("/chat/")) {
      // Already on chat page — send directly in current session
      window.dispatchEvent(
        new CustomEvent<VoiceSubmitEventDetail>(VOICE_SUBMIT_EVENT, {
          detail: { text, startNewSession: false },
        })
      );
      return;
    }
    // From other pages — navigate to chat and start a new session
    const payload: PendingVoiceText = { text, startNewSession: true };
    sessionStorage.setItem(PENDING_VOICE_TEXT_KEY, JSON.stringify(payload));
    router.push("/chat");
  }, [pathname, router]);

  const cleanupASR = useCallback(() => {
    if (sendIntervalRef.current) { clearInterval(sendIntervalRef.current); sendIntervalRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    const ws = wsRef.current;
    if (ws) { if (ws.readyState === WebSocket.OPEN) ws.close(); wsRef.current = null; }
  }, []);

  const startASR = useCallback(async () => {
    try {
      const unavailableMessage = getVoiceUnavailableMessage();
      if (unavailableMessage) {
        alert(unavailableMessage);
        isListeningRef.current = false;
        shouldSendRef.current = false;
        setIsListening(false);
        return;
      }

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
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        setVolumeBars(Array(5).fill(0).map((_, i) => {
          const offset = Math.abs(i - 2) * 0.15;
          return Math.min(1, rms * 8 + 0.05 + offset * 0.3);
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const ws = new WebSocket(getAsrWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", language: "zh-CN" }));
        sendIntervalRef.current = setInterval(() => {
          const chunks = audioChunksRef.current.splice(0);
          if (chunks.length === 0 || ws.readyState !== WebSocket.OPEN) return;
          const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
          const int16 = new Int16Array(merged.length);
          for (let i = 0; i < merged.length; i++) int16[i] = Math.max(-32768, Math.min(32767, merged[i] * 32767));
          ws.send(int16.buffer);
        }, 200);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "result" && msg.text) {
            transcriptRef.current = msg.text;
            setTranscript(msg.text);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        cleanupASR();
        if (shouldSendRef.current) {
          shouldSendRef.current = false;
          const text = transcriptRef.current.trim();
          transcriptRef.current = "";
          setTranscript("");
          setIsListening(false);
          setVolumeBars(Array(5).fill(0.15));
          if (text) submitVoiceText(text);
        }
      };

      ws.onerror = () => {
        shouldSendRef.current = false;
        cleanupASR();
        setIsListening(false);
      };
    } catch (error) {
      console.error("[Voice] Failed to start bottom nav recording:", error);
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "无法启动录音，请在浏览器设置中允许麦克风权限。"
          : "无法启动录音，请检查麦克风权限";
      alert(message);
      isListeningRef.current = false;
      shouldSendRef.current = false;
      setIsListening(false);
    }
  }, [cleanupASR, submitVoiceText]);

  const startPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === "touchstart") e.preventDefault();
    pressTimerRef.current = setTimeout(() => {
      isListeningRef.current = true;
      shouldSendRef.current = false;
      setIsListening(true);
      setTranscript("");
      transcriptRef.current = "";
      startASR();
    }, 300);
  }, [startASR]);

  const endPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === "touchend") e.preventDefault();
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }

    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    shouldSendRef.current = true;

    // Flush remaining audio then send end — proxy will close the connection,
    // triggering ws.onclose which handles navigation
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const chunks = audioChunksRef.current.splice(0);
      if (chunks.length > 0) {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        const int16 = new Int16Array(merged.length);
        for (let i = 0; i < merged.length; i++) int16[i] = Math.max(-32768, Math.min(32767, merged[i] * 32767));
        ws.send(int16.buffer);
      }
      ws.send(JSON.stringify({ type: "end" }));
    } else {
      // No WS connection, just clean up
      cleanupASR();
      setIsListening(false);
      setVolumeBars(Array(5).fill(0.15));
    }
  }, [cleanupASR]);

  // Cleanup on unmount
  useEffect(() => () => cleanupASR(), [cleanupASR]);

  return (
    <>
      {/* Voice Input Overlay */}
      <div
        className={`fixed top-0 left-0 w-full p-4 z-[60] transition-transform duration-300 ${
          isListening ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="bg-surface/90 backdrop-blur-xl rounded-2xl shadow-lg border border-outline-variant/30 p-6 flex flex-col items-center gap-4">
          <div className="flex items-end gap-1 h-10">
            {volumeBars.map((v, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-secondary transition-all duration-75"
                style={{ height: `${Math.max(6, v * 36)}px` }}
              />
            ))}
          </div>
          <p className="text-base text-on-surface min-h-[1.5rem] text-center">
            {transcript || <span className="text-on-surface-variant italic">正在聆听...</span>}
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-40 bg-surface/85 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(45,45,45,0.12)] border border-outline-variant/20 flex justify-between items-center px-4 py-0.5">
        {/* Left items */}
        {navItems.slice(0, 2).map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === "/chat" ? handleChatNavClick : markChatRestoreIntent}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive ? "text-secondary" : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <Icon name={item.icon} size={22} filled={isActive} className="mb-1" />
              <span className="text-xs font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Voice Button */}
        <button
          className={`no-select flex items-center justify-center rounded-full w-14 h-14 -translate-y-4 shadow-lg transition-all duration-300 active:scale-95 flex-shrink-0 ${
            isListening ? "bg-secondary-fixed-dim text-on-secondary-fixed scale-110" : "bg-secondary text-on-secondary"
          }`}
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onTouchCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Voice input - long press to speak"
        >
          <Mic size={24} fill="currentColor" />
        </button>

        {/* Right items */}
        {navItems.slice(2).map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={markChatRestoreIntent}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive ? "text-secondary" : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <Icon name={item.icon} size={22} filled={isActive} className="mb-1" />
              <span className="text-xs font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
