"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  formatNotificationTime,
  type NotificationItem,
  type PullNotificationResponse,
} from "@/lib/notifications";

type CloseReason = "auto" | "action" | "swipe";

const POLL_INTERVAL_MS = 30 * 1000;
const AUTO_CLOSE_MS = 8000;
const SWIPE_DISMISS_THRESHOLD = 90;

export function NotificationToast() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const dragStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const pullNextNotification = useCallback(async () => {
    if (typeof window === "undefined" || isPullingRef.current || isOpen) {
      return;
    }

    isPullingRef.current = true;
    try {
      const response = await fetch("/api/notifications/pull", {
        method: "POST",
        cache: "no-store",
      });

      if (response.status === 401) {
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as PullNotificationResponse;
      if (data.notification) {
        setNotification(data.notification);
        setIsOpen(true);
      }
    } finally {
      isPullingRef.current = false;
    }
  }, [isOpen]);

  const markCurrentNotificationRead = useCallback(async () => {
    if (!notification || !notification.unread) {
      return;
    }

    try {
      await fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "read" }),
      });
    } catch {
      // Ignore transient failures; the notification center still holds the record.
    }
  }, [notification]);

  const close = useCallback(
    async (reason: CloseReason) => {
      if (reason !== "auto") {
        await markCurrentNotificationRead();
      }

      setIsOpen(false);
      setIsDragging(false);
      setDragOffset(0);
      setNotification(null);
    },
    [markCurrentNotificationRead]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    void pullNextNotification();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pullNextNotification();
      }
    }, POLL_INTERVAL_MS);

    const handleFocus = () => {
      void pullNextNotification();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pullNextNotification();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pullNextNotification]);

  useEffect(() => {
    void pullNextNotification();
  }, [pathname, pullNextNotification]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      void close("auto");
    }, AUTO_CLOSE_MS);
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
        className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-24 md:pt-10 pointer-events-none"
        aria-live="polite"
        aria-hidden={!isOpen}
      >
        <section
          role="dialog"
          aria-modal="true"
          className={`relative z-20 w-full max-w-md rounded-3xl border border-outline-variant/40 bg-surface-container-highest p-6 shadow-[0_20px_50px_rgba(45,45,45,0.16)] pointer-events-auto ${
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
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
                {notification?.source || "系统通知"}
              </p>
              <h2 className="mt-2 text-xl font-[var(--font-display)] text-on-surface">
                {notification?.title || "通知"}
              </h2>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void close("action");
              }}
              className="text-on-surface-variant/70 transition-colors duration-200 hover:text-on-surface"
              aria-label="Dismiss notification"
            >
              <Icon name="close" />
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            {notification?.body || ""}
          </p>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant/60">
              {notification ? formatNotificationTime(notification.createdAt) : ""}
            </span>
            {notification?.actionUrl ? (
              <Link
                href={notification.actionUrl}
                onClick={(event) => {
                  event.stopPropagation();
                  void close("action");
                }}
                className="rounded-full bg-secondary px-5 py-2 text-sm font-medium text-on-secondary shadow-md transition-transform duration-200 active:scale-95"
              >
                查看
              </Link>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void close("action");
                }}
                className="rounded-full bg-secondary px-5 py-2 text-sm font-medium text-on-secondary shadow-md transition-transform duration-200 active:scale-95"
              >
                知道了
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
