"use client";

import { useState, useRef, useCallback } from "react";
import { getAsrWebSocketUrl, getVoiceUnavailableMessage } from "@/lib/voice-client";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [volumeBars, setVolumeBars] = useState<number[]>(Array(20).fill(0.15));

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTextRef = useRef("");

  const cleanup = useCallback(() => {
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
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    cleanup();

    try {
      const unavailableMessage = getVoiceUnavailableMessage();
      if (unavailableMessage) {
        alert(unavailableMessage);
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
        // Update waveform bars
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        setVolumeBars((prev) => {
          const next = [...prev.slice(1), Math.min(1, rms * 8 + 0.05)];
          return next;
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const ws = new WebSocket(getAsrWebSocketUrl());
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
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }

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
        cleanup();
        setIsRecording(false);
        alert("语音服务连接失败，请确保已运行 pnpm asr-proxy");
      };

      ws.onclose = () => {
        cleanup();
      };

      setIsRecording(true);
      recordingTextRef.current = "";
    } catch (err) {
      console.error("[Voice] Failed to start recording:", err);
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "无法启动录音，请在浏览器设置中允许麦克风权限。"
          : "无法启动录音，请检查麦克风权限";
      alert(message);
    }
  }, [isRecording, cleanup]);

  const stopRecording = useCallback(() => {
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

    cleanup();
    setIsRecording(false);
  }, [isRecording, cleanup]);

  return {
    isRecording,
    volumeBars,
    recordingTextRef,
    startRecording,
    stopRecording,
    cleanup,
  };
}
