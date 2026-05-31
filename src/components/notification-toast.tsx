"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CloseReason = "auto" | "action" | "backdrop" | "swipe";

const STORAGE_KEY = "mindful.notification.nextShowAt";
const INITIAL_DELAY_MS = 15000;
const REPEAT_INTERVAL_MS = 45 * 60 * 1000;
const AUTO_CLOSE_MS = 8000;
const SWIPE_DISMISS_THRESHOLD = 90;

function getStoredTimestamp(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NotificationToast() {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  const show = useCallback(() => {
    setIsOpen(true);
  }, []);

  const scheduleNext = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextShowAt = Date.now() + REPEAT_INTERVAL_MS;
    window.localStorage.setItem(STORAGE_KEY, String(nextShowAt));
  }, []);

  const close = useCallback(
    (reason: CloseReason) => {
      setIsOpen(false);
      setIsDragging(false);
      setDragOffset(0);
      scheduleNext();
    },
    [scheduleNext]
  );


  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const now = Date.now();
    const stored = getStoredTimestamp();
    const nextShowAt = stored ?? now + INITIAL_DELAY_MS;
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, String(nextShowAt));
    }
    const rawDelay = Math.max(nextShowAt - now, 0);
    const delay = Math.min(rawDelay, INITIAL_DELAY_MS);
    const timer = window.setTimeout(show, delay);
    return () => window.clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = window.setTimeout(() => close("auto"), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, close]);

  const motionStyle = useMemo(() => {
    const baseOffset = isOpen ? 0 : -24;
    return {
      transform: `translateY(${baseOffset + dragOffset}px)`,
      transition: isDragging
        ? "none"
        : "transform 300ms ease, opacity 300ms ease",
    };
  }, [isOpen, dragOffset, isDragging]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    dragStartYRef.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (!isDragging) {
        return;
      }
      const delta = event.clientY - dragStartYRef.current;
      if (delta < 0) {
        setDragOffset(delta);
      }
    },
    [isDragging]
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (!isDragging) {
        return;
      }
      const delta = event.clientY - dragStartYRef.current;
      setIsDragging(false);
      setDragOffset(0);
      if (delta < -SWIPE_DISMISS_THRESHOLD) {
        close("swipe");
      }
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [isDragging, close]
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] flex items-start justify-center px-4 pt-24 md:pt-10 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-live="polite"
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            close("backdrop");
          }}
          className={`absolute inset-0 z-10 bg-inverse-surface/10 backdrop-blur-[2px] transition-opacity duration-300 ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          aria-label="Close notification"
        />

        <section
          role="dialog"
          aria-modal="true"
          className={`relative z-20 w-full max-w-md rounded-3xl border border-outline-variant/40 bg-surface-container-highest p-6 shadow-[0_20px_50px_rgba(45,45,45,0.16)] ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          style={motionStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant/70">
                健康提醒
              </p>
              <h2 className="mt-2 text-xl font-[var(--font-display)] text-on-surface">
                是时候起身放松一下
              </h2>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                close("action");
              }}
              className="text-on-surface-variant/70 transition-colors duration-200 hover:text-on-surface"
              aria-label="Dismiss notification"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            你已工作许久，站起来活动一下，喝一杯水，给眼睛一点休息时间。
          </p>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant/60">
              轻触上方即可滑动关闭
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                close("action");
              }}
              className="rounded-full bg-secondary px-5 py-2 text-sm font-medium text-on-secondary shadow-md transition-transform duration-200 active:scale-95"
            >
              知道了
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
