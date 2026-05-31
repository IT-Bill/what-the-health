"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  formatNotificationTime,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationMutationResponse,
} from "@/lib/notifications";

const REFRESH_INTERVAL_MS = 5 * 1000;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unreadCount = notifications.filter((item) => item.unread).length;

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) {
        setNotifications([]);
        setError("请先登录后查看通知。\n");
        return;
      }
      if (!response.ok) {
        throw new Error("load-failed");
      }

      const data = (await response.json()) as NotificationListResponse;
      setNotifications(data.notifications);
      setError(null);
    } catch {
      setError("加载通知失败，请稍后重试。");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications({ silent: true });
      }
    };

    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadNotifications]);

  async function handleMarkRead(id: string) {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "read" }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as NotificationMutationResponse;
    setNotifications((current) =>
      current.map((item) => (item.id === id ? data.notification : item))
    );
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return;
    }

    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  async function handleClearAll() {
    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    setNotifications([]);
  }

  return (
    <AppShell
      topAppBarProps={{
        rightAction: "back",
        rightAriaLabel: "返回上一页",
      }}
    >
      <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant/70">
            Mindful
          </p>
          <h1 className="text-3xl font-[var(--font-display)] text-on-surface">
            通知中心
          </h1>
          <p className="text-sm text-on-surface-variant">
            这里汇总你的健康提醒与动态更新。
          </p>
        </header>

        <section className="bg-surface-container-low rounded-3xl p-4 md:p-6 border border-outline-variant/20 ambient-shadow space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-on-surface-variant">
              未读通知 {unreadCount} 条
            </div>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={notifications.length === 0}
              className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm text-on-surface transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              清空全部
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-2xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface px-5 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 block">notifications_off</span>
              <p className="text-base text-on-surface whitespace-pre-line">{error}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm text-on-surface"
                >
                  重试
                </button>
                <Link
                  href="/login"
                  className="rounded-full bg-secondary px-4 py-2 text-sm text-on-secondary"
                >
                  去登录
                </Link>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface px-5 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 block">notifications_off</span>
              <p className="text-base text-on-surface">暂时没有通知</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                新提醒出现后会自动加入这里。
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border px-4 py-4 md:px-5 md:py-5 transition-all duration-300 ${
                  item.unread
                    ? "border-secondary/30 bg-secondary-container/30"
                    : "border-outline-variant/30 bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.unread) {
                        void handleMarkRead(item.id);
                      }
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-medium text-on-surface">
                        {item.title}
                      </h2>
                      {item.unread ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-secondary" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                      {item.body}
                    </p>
                    <div className="mt-3 text-xs text-on-surface-variant/70">
                      {formatNotificationTime(item.createdAt)}
                    </div>
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    {item.actionUrl ? (
                      <Link
                        href={item.actionUrl}
                        className="inline-flex items-center gap-1 rounded-full border border-secondary/30 px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-secondary-container/40"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        查看
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface hover:text-on-surface"
                      aria-label={`删除${item.title}`}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <div className="text-center text-xs text-on-surface-variant/70">
          所有通知由数据库驱动，其他代理可通过 API 投递
        </div>
      </div>
    </AppShell>
  );
}
