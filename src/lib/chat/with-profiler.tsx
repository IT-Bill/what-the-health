"use client";

import { useRef, useCallback, type ReactNode } from "react";
import type { ProfilerOnRenderCallback } from "react";
import { type RenderMetrics } from "./performance";

interface WithProfilerProps {
  name: string;
  children: ReactNode;
  onMetricsUpdate?: (metrics: RenderMetrics) => void;
}

interface RenderRecord {
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

/**
 * WithProfiler — component wrapper that automatically tracks renders
 * using React's Profiler API and reports metrics via onMetricsUpdate callback.
 */
export function WithProfiler({ name, children, onMetricsUpdate }: WithProfilerProps) {
  const recordsRef = useRef<RenderRecord[]>([]);
  const callbackRef = useRef(onMetricsUpdate);
  callbackRef.current = onMetricsUpdate;

  const profilerCallback: ProfilerOnRenderCallback = useCallback(
    (_id, _phase, actualDuration, baseDuration, startTime, commitTime) => {
      recordsRef.current.push({ actualDuration, baseDuration, startTime, commitTime });

      const all = recordsRef.current;
      const totalRenderTime = all.reduce((sum, r) => sum + r.actualDuration, 0);
      const maxRenderTime = all.length > 0 ? Math.max(...all.map((r) => r.actualDuration)) : 0;

      const metrics: RenderMetrics = {
        componentName: name,
        renderCount: all.length,
        totalRenderTime,
        avgRenderTime: all.length > 0 ? totalRenderTime / all.length : 0,
        maxRenderTime,
      };
      callbackRef.current?.(metrics);
    },
    [name]
  );

  return (
    <React.Profiler id={name} onRender={profilerCallback}>
      {children}
    </React.Profiler>
  );
}

import React from "react";
