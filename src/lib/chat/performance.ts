"use client";

import { useRef, useCallback, useState, type ReactNode } from "react";
import type { ProfilerOnRenderCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  avgRenderTime: number;
  maxRenderTime: number;
}

interface RenderRecord {
  id: number;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

// ---------------------------------------------------------------------------
// useRenderTracker — hook wrapping React Profiler
// ---------------------------------------------------------------------------

export function useRenderTracker(componentName: string): {
  onRender: ProfilerOnRenderCallback;
  metrics: RenderMetrics;
  reset: () => void;
} {
  const recordsRef = useRef<RenderRecord[]>([]);
  const idRef = useRef(0);
  const [metrics, setMetrics] = useState<RenderMetrics>({
    componentName,
    renderCount: 0,
    totalRenderTime: 0,
    avgRenderTime: 0,
    maxRenderTime: 0,
  });

  const onRender: ProfilerOnRenderCallback = useCallback(
    (
      _id: string,
      _phase: "mount" | "update" | "nested-update",
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      const record: RenderRecord = {
        id: idRef.current++,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      };
      recordsRef.current.push(record);

      const all = recordsRef.current;
      const totalRenderTime = all.reduce((sum, r) => sum + r.actualDuration, 0);
      const maxRenderTime = Math.max(...all.map((r) => r.actualDuration));

      setMetrics({
        componentName,
        renderCount: all.length,
        totalRenderTime,
        avgRenderTime: totalRenderTime / all.length,
        maxRenderTime,
      });
    },
    [componentName]
  );

  const reset = useCallback(() => {
    recordsRef.current = [];
    idRef.current = 0;
    setMetrics({
      componentName,
      renderCount: 0,
      totalRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
    });
  }, [componentName]);

  return { onRender, metrics, reset };
}

// ---------------------------------------------------------------------------
// simulateStreamingUpdates — simulates streaming text deltas
// ---------------------------------------------------------------------------

export async function simulateStreamingUpdates(
  updateFn: (delta: string) => void,
  deltas: string[],
  intervalMs: number
): Promise<{ totalUpdates: number; totalTime: number }> {
  const startTime = performance.now();
  let count = 0;

  for (const delta of deltas) {
    await sleep(intervalMs);
    updateFn(delta);
    count++;
  }

  const totalTime = performance.now() - startTime;
  return { totalUpdates: count, totalTime };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// runBenchmark — generic benchmark runner
// ---------------------------------------------------------------------------

export interface BenchmarkOptions {
  name: string;
  setup: () => void;
  teardown: () => void;
  iterations: number;
}

export interface BenchmarkResult {
  avgTime: number;
  minTime: number;
  maxTime: number;
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const times: number[] = [];

  for (let i = 0; i < options.iterations; i++) {
    options.setup();
    const start = performance.now();

    // The actual work is expected to happen in setup or via side effects
    // This is a minimal framework — callers instrument their own work
    await sleep(0); // yield to let React render

    const end = performance.now();
    times.push(end - start);
    options.teardown();
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return { avgTime, minTime, maxTime };
}
