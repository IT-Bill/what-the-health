"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type NotificationItem,
  type PullNotificationResponse,
} from "@/lib/notifications";

type CloseReason = "auto" | "action" | "swipe";

const POLL_INTERVAL_MS = 5 * 1000;
const AUTO_CLOSE_MS = 8000;
const SWIPE_DISMISS_THRESHOLD = 90;
const TITLE_MAX_LENGTH = 18;
const BODY_MAX_LENGTH = 28;

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(maxLength - 2, 0)).trimEnd()}……`;
}

export function NotificationToast() {
  const pathname = usePathname();
  const router = useRouter();
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

  const displayTitle = notification
    ? truncateText(notification.title, TITLE_MAX_LENGTH)
    : "通知";
  const displayBody = notification
    ? truncateText(notification.body, BODY_MAX_LENGTH)
    : "";

  const handleAction = useCallback(async () => {
    if (!notification?.actionUrl) {
      return;
    }

    await close("action");
    router.push(notification.actionUrl);
  }, [close, notification, router]);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-20 md:pt-6 pointer-events-none"
        aria-live="polite"
        aria-hidden={!isOpen}
      >
        <section
          role="dialog"
          aria-modal="true"
          className={`relative z-20 w-full max-w-md rounded-2xl border border-outline-variant/25 bg-surface/88 backdrop-blur-xl shadow-[0_18px_40px_rgba(45,45,45,0.10)] pointer-events-auto ${
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={motionStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="material-symbols-outlined shrink-0 text-[18px] text-primary">
              notifications
            </span>
            <button
              type="button"
              onClick={() => void handleAction()}
              disabled={!notification?.actionUrl}
              className="min-w-0 flex-1 text-left disabled:cursor-default"
            >
              <h2 className="truncate text-sm font-[var(--font-display)] text-on-surface leading-5">
                {displayTitle}
              </h2>
              <p className="truncate text-xs leading-5 text-on-surface-variant/85">
                {displayBody}
              </p>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void close("action");
              }}
              className="shrink-0 rounded-full p-1 text-on-surface-variant/70 transition-colors duration-200 hover:bg-surface-container-low hover:text-on-surface"
              aria-label="Dismiss notification"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
