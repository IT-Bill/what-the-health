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

  const submitVoiceText = useCallback((text: string) => {
    const payload: PendingVoiceText = { text, startNewSession: true };
    if (pathname === "/chat") {
      window.dispatchEvent(
        new CustomEvent<VoiceSubmitEventDetail>(VOICE_SUBMIT_EVENT, {
          detail: payload,
        })
      );
      return;
    }
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

      const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const wsUrl = isDev ? `ws://localhost:3001` : `wss://${window.location.host}/api/asr`;
      const ws = new WebSocket(wsUrl);
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
    } catch {
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl rounded-t-3xl shadow-[0_-20px_40px_rgba(45,45,45,0.04)] flex justify-between items-center px-4 pb-6 pt-3">
        {navItems.slice(0, 2).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === "/chat" ? undefined : markChatRestoreIntent}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive ? "text-secondary" : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <span className="material-symbols-outlined mb-1" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
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
          aria-label="Voice input - long press to speak"
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
        </button>

        {navItems.slice(2).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={markChatRestoreIntent}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive ? "text-secondary" : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <span className="material-symbols-outlined mb-1" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-xs font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
