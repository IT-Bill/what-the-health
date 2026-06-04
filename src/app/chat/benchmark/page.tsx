"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { simulateStreamingUpdates } from "@/lib/chat/performance";
import { useChatStore } from "@/lib/chat/store";

// ---------------------------------------------------------------------------
// Global render counters (exposed to window for external test scripts)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __benchmarkCounters?: {
      baselineInput: number;
      baselineMessageList: number;
      storeInput: number;
      storeMessageList: number;
      reset: (mode?: "baseline" | "store") => void;
    };
  }
}

if (typeof window !== "undefined") {
  window.__benchmarkCounters = {
    baselineInput: 0,
    baselineMessageList: 0,
    storeInput: 0,
    storeMessageList: 0,
    reset(mode?: "baseline" | "store") {
      if (!mode || mode === "baseline") {
        this.baselineInput = 0;
        this.baselineMessageList = 0;
      }
      if (!mode || mode === "store") {
        this.storeInput = 0;
        this.storeMessageList = 0;
      }
    },
  };
}

type CounterKey = "baselineInput" | "baselineMessageList" | "storeInput" | "storeMessageList";

function useRenderCount(key: CounterKey) {
  const countRef = useRef(0);
  countRef.current++;
  if (typeof window !== "undefined" && window.__benchmarkCounters) {
    window.__benchmarkCounters[key] = countRef.current;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  mode: "baseline" | "store";
  inputRenders: number;
  messageListRenders: number;
  streamingDuration: number;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Generate test deltas
// ---------------------------------------------------------------------------

function generateDeltas(): string[] {
  const text =
    "在这个快节奏的世界里，我们常常会感到焦虑和不安。正念练习可以帮助我们回到当下，觉察自己的呼吸和身体感受。通过每天几分钟的冥想，我们可以培养内心的平静与安宁。记住，每一次呼吸都是一个新的开始，每一个当下都是珍贵的礼物。让我们学会善待自己，接纳此刻的一切感受。";
  const deltas: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const chunkSize = Math.min(remaining.length, Math.floor(Math.random() * 4) + 2);
    deltas.push(remaining.slice(0, chunkSize));
    remaining = remaining.slice(chunkSize);
  }
  while (deltas.length < 50) deltas.push(" ");
  return deltas.slice(0, 50);
}

// ---------------------------------------------------------------------------
// Baseline Components (useState)
// ---------------------------------------------------------------------------

function BaselineInput({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  useRenderCount("baselineInput");

  return (
    <div className="flex items-end gap-2 bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[28px] shadow-[0_12px_32px_rgba(45,45,45,0.04)] px-2 py-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="分享你的感受..."
        rows={1}
        disabled={disabled}
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none py-2.5 px-1 text-on-surface text-base placeholder-on-surface-variant/50 max-h-[120px] overflow-y-auto no-scrollbar"
        style={{ minHeight: "40px" }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-on-surface text-surface hover:opacity-90 transition-all disabled:opacity-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 12"/><path d="M12 19V5"/></svg>
      </button>
    </div>
  );
}

function BaselineMessageList({ messages }: { messages: Message[] }) {
  useRenderCount("baselineMessageList");

  return (
    <div className="flex-1 w-full px-4 md:px-6 overflow-y-auto flex flex-col gap-1 pt-4">
      {messages.map((msg) =>
        msg.role === "agent" ? (
          <div key={msg.id} className="w-full py-3">
            <div className="text-on-surface text-base leading-relaxed">
              {msg.content || (msg.isStreaming ? "..." : "")}
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex w-full justify-end py-1">
            <div className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5 max-w-[85%] md:max-w-[70%]">
              <p className="text-on-surface text-base leading-relaxed">{msg.content}</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Store Components (Zustand) — fine-grained subscriptions
// ---------------------------------------------------------------------------

function StoreInput({ onSend }: { onSend: () => void }) {
  useRenderCount("storeInput");
  const input = useChatStore((s) => s.input);
  const setInput = useChatStore((s) => s.setInput);
  const isStreaming = useChatStore((s) => s.isStreaming);

  return (
    <div className="flex items-end gap-2 bg-surface/60 backdrop-blur-xl border border-outline-variant/30 rounded-[28px] shadow-[0_12px_32px_rgba(45,45,45,0.04)] px-2 py-1.5">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="分享你的感受..."
        rows={1}
        disabled={isStreaming}
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none py-2.5 px-1 text-on-surface text-base placeholder-on-surface-variant/50 max-h-[120px] overflow-y-auto no-scrollbar"
        style={{ minHeight: "40px" }}
      />
      <button
        onClick={onSend}
        disabled={isStreaming || !input.trim()}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-on-surface text-surface hover:opacity-90 transition-all disabled:opacity-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 12"/><path d="M12 19V5"/></svg>
      </button>
    </div>
  );
}

function StoreMessageList() {
  useRenderCount("storeMessageList");
  const messages = useChatStore((s) => s.messages);

  return (
    <div className="flex-1 w-full px-4 md:px-6 overflow-y-auto flex flex-col gap-1 pt-4">
      {messages.map((msg) =>
        msg.role === "agent" ? (
          <div key={msg.id} className="w-full py-3">
            <div className="text-on-surface text-base leading-relaxed">
              {msg.content || (msg.isStreaming ? "..." : "")}
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex w-full justify-end py-1">
            <div className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5 max-w-[85%] md:max-w-[70%]">
              <p className="text-on-surface text-base leading-relaxed">{msg.content}</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Benchmark Page
// ---------------------------------------------------------------------------

export default function BenchmarkPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [status, setStatus] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"baseline" | "store">("baseline");

  // Baseline state
  const [baselineMessages, setBaselineMessages] = useState<Message[]>([
    { id: "init", role: "agent", content: "欢迎回来。我是 WiTH，你的疗愈陪伴者。" },
  ]);
  const [baselineInput, setBaselineInput] = useState("");
  const [baselineStreaming, setBaselineStreaming] = useState(false);
  const baselineAccRef = useRef("");

  const resetBaseline = useCallback(() => {
    setBaselineMessages([
      { id: "init", role: "agent", content: "欢迎回来。我是 WiTH，你的疗愈陪伴者。" },
    ]);
    setBaselineInput("");
    setBaselineStreaming(false);
    baselineAccRef.current = "";
  }, []);

  const resetStore = useCallback(() => {
    const store = useChatStore.getState();
    store.setMessages([
      { id: "init", role: "agent", content: "欢迎回来。我是 WiTH，你的疗愈陪伴者。" },
    ]);
    store.setInput("");
    store.setIsStreaming(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Benchmark runners
  // ---------------------------------------------------------------------------

  const runBaselineBenchmark = useCallback(async () => {
    setPreviewMode("baseline");
    setStatus("Running baseline (useState)...");
    await new Promise((r) => setTimeout(r, 100)); // Wait for component mount
    window.__benchmarkCounters?.reset("baseline");
    resetBaseline();
    await new Promise((r) => setTimeout(r, 50));
    window.__benchmarkCounters?.reset("baseline"); // Reset after initial mount

    const deltas = generateDeltas();
    const intervalMs = 2000 / 50;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: "请给我一些正念练习的建议" };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "agent", content: "", isStreaming: true };

    setBaselineMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBaselineStreaming(true);
    baselineAccRef.current = "";

    await new Promise((r) => setTimeout(r, 50));

    const streamingStart = performance.now();

    await simulateStreamingUpdates(
      (delta) => {
        baselineAccRef.current += delta;
        setBaselineMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: baselineAccRef.current } : m))
        );
      },
      deltas,
      intervalMs
    );

    const streamingDuration = performance.now() - streamingStart;

    setBaselineMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
    );
    setBaselineStreaming(false);

    await new Promise((r) => setTimeout(r, 100));

    const counters = window.__benchmarkCounters;
    const result: BenchmarkResult = {
      mode: "baseline",
      inputRenders: counters?.baselineInput ?? 0,
      messageListRenders: counters?.baselineMessageList ?? 0,
      streamingDuration,
    };

    setResults((prev) => [...prev, result]);
    setStatus("Baseline complete.");
  }, [resetBaseline, setPreviewMode]);

  const runStoreBenchmark = useCallback(async () => {
    setPreviewMode("store");
    setStatus("Running store (Zustand)...");
    await new Promise((r) => setTimeout(r, 100)); // Wait for component mount
    window.__benchmarkCounters?.reset("store");
    resetStore();
    await new Promise((r) => setTimeout(r, 50));
    window.__benchmarkCounters?.reset("store");

    const deltas = generateDeltas();
    const intervalMs = 2000 / 50;
    const store = useChatStore.getState();

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: "请给我一些正念练习的建议" };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "agent", content: "", isStreaming: true };

    store.setMessages((prev) => [...prev, userMsg, assistantMsg]);
    store.setIsStreaming(true);
    store.setInput("");

    let acc = "";
    await new Promise((r) => setTimeout(r, 50));

    const streamingStart = performance.now();

    await simulateStreamingUpdates(
      (delta) => {
        acc += delta;
        store.updateMessage(assistantId, { content: acc });
      },
      deltas,
      intervalMs
    );

    const streamingDuration = performance.now() - streamingStart;

    store.updateMessage(assistantId, { isStreaming: false });
    store.setIsStreaming(false);

    await new Promise((r) => setTimeout(r, 100));

    const counters = window.__benchmarkCounters;
    const result: BenchmarkResult = {
      mode: "store",
      inputRenders: counters?.storeInput ?? 0,
      messageListRenders: counters?.storeMessageList ?? 0,
      streamingDuration,
    };

    setResults((prev) => [...prev, result]);
    setStatus("Store complete.");
  }, [resetStore, setPreviewMode]);

  const handleRunBenchmark = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResults([]);

    try {
      await runBaselineBenchmark();
      await new Promise((r) => setTimeout(r, 200));
      await runStoreBenchmark();
    } finally {
      setIsRunning(false);
      setStatus("All benchmarks complete.");
    }
  }, [isRunning, runBaselineBenchmark, runStoreBenchmark]);

  const handleClearResults = useCallback(() => {
    setResults([]);
    setStatus("");
    resetBaseline();
    resetStore();
    window.__benchmarkCounters?.reset();
  }, [resetBaseline, resetStore]);

  // ---------------------------------------------------------------------------
  // Interactive send
  // ---------------------------------------------------------------------------

  const handleBaselineSend = useCallback(() => {
    const text = baselineInput.trim();
    if (!text || baselineStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "agent", content: "", isStreaming: true };

    setBaselineMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBaselineInput("");
    setBaselineStreaming(true);
    baselineAccRef.current = "";

    const deltas = generateDeltas();
    simulateStreamingUpdates(
      (delta) => {
        baselineAccRef.current += delta;
        setBaselineMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: baselineAccRef.current } : m))
        );
      },
      deltas,
      2000 / 50
    ).then(() => {
      setBaselineMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
      setBaselineStreaming(false);
    });
  }, [baselineInput, baselineStreaming]);

  const handleStoreSend = useCallback(() => {
    const store = useChatStore.getState();
    const text = store.input.trim();
    if (!text || store.isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "agent", content: "", isStreaming: true };

    store.setMessages((prev) => [...prev, userMsg, assistantMsg]);
    store.setInput("");
    store.setIsStreaming(true);

    let acc = "";
    const deltas = generateDeltas();
    simulateStreamingUpdates(
      (delta) => {
        acc += delta;
        store.updateMessage(assistantId, { content: acc });
      },
      deltas,
      2000 / 50
    ).then(() => {
      store.updateMessage(assistantId, { isStreaming: false });
      store.setIsStreaming(false);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[100dvh] bg-background text-on-surface">
      <header className="border-b border-outline-variant/20 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-[800px] mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-medium text-on-surface">Chat Performance Benchmark</h1>
              <p className="text-sm text-on-surface-variant mt-1">
                Measures re-render performance: baseline (useState) vs store (Zustand)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunBenchmark}
                disabled={isRunning}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isRunning ? "Running..." : "Run Both"}
              </button>
              <button
                onClick={handleClearResults}
                disabled={isRunning}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-medium text-sm hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
          {status && <p className="text-sm text-on-surface-variant mt-2">{status}</p>}
        </div>
      </header>

      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6">
        {/* Results Table */}
        {results.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-on-surface mb-4">Results</h2>
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/20">
              <table className="w-full text-sm">
                <thead className="bg-surface-container text-on-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Mode</th>
                    <th className="px-4 py-3 text-right font-medium">Input Renders</th>
                    <th className="px-4 py-3 text-right font-medium">MsgList Renders</th>
                    <th className="px-4 py-3 text-right font-medium">Streaming (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.mode === "baseline"
                            ? "bg-secondary-container text-on-secondary-container"
                            : "bg-primary-container text-on-primary-container"
                        }`}>
                          {r.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.inputRenders}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.messageListRenders}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.streamingDuration.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary comparison */}
            {results.length >= 2 && (
              <div className="mt-4 p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/10">
                <h3 className="text-sm font-medium text-on-surface mb-2">Comparison</h3>
                {(() => {
                  const baseline = results.find((r) => r.mode === "baseline");
                  const store = results.find((r) => r.mode === "store");
                  if (!baseline || !store) return null;
                  const inputReduction = baseline.inputRenders > 0
                    ? ((1 - store.inputRenders / baseline.inputRenders) * 100).toFixed(0)
                    : "0";
                  return (
                    <div className="text-sm text-on-surface-variant space-y-1">
                      <p>
                        Input re-renders: <strong className="text-on-surface">{baseline.inputRenders}</strong> →{" "}
                        <strong className="text-primary">{store.inputRenders}</strong>
                        {" "}(<strong className="text-primary">{inputReduction}% fewer</strong>)
                      </p>
                      <p>
                        MessageList renders: baseline={baseline.messageListRenders}, store={store.messageListRenders}
                        {" "}(both render once per delta — expected)
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Interactive Preview */}
        <div className="rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="bg-surface-container-low/50 px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-on-surface">
                {previewMode === "baseline" ? "Baseline Preview (useState)" : "Store Preview (Zustand)"}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Send a message to see streaming in action.
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPreviewMode("baseline")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  previewMode === "baseline"
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Baseline
              </button>
              <button
                onClick={() => setPreviewMode("store")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  previewMode === "store"
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Store
              </button>
            </div>
          </div>

          <div className="h-[400px] flex flex-col bg-background">
            {previewMode === "baseline" ? (
              <>
                <BaselineMessageList messages={baselineMessages} />
                <div className="p-4 border-t border-outline-variant/10">
                  <BaselineInput
                    value={baselineInput}
                    onChange={setBaselineInput}
                    onSend={handleBaselineSend}
                    disabled={baselineStreaming}
                  />
                </div>
              </>
            ) : (
              <>
                <StoreMessageList />
                <div className="p-4 border-t border-outline-variant/10">
                  <StoreInput onSend={handleStoreSend} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 text-xs text-on-surface-variant space-y-1">
          <p><strong>Input Renders:</strong> Times input re-rendered (should be ~0 with Zustand during streaming)</p>
          <p><strong>MsgList Renders:</strong> Times message list re-rendered (one per delta + mount)</p>
          <p><strong>Key difference:</strong> useState triggers all sibling components on parent update; Zustand only re-renders subscribers</p>
        </div>
      </div>
    </div>
  );
}
