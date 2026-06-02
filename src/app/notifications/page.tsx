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
import { Icon } from "@/components/icon";

const REFRESH_INTERVAL_MS = 5 * 1000;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) {
        setNotifications([]);
        setError("请先登录后查看通知。");
        return;
      }
      if (!response.ok) throw new Error("load-failed");
      const data = (await response.json()) as NotificationListResponse;
      setNotifications(data.notifications);
      setError(null);
    } catch {
      setError("加载通知失败，请稍后重试。");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadNotifications(), 0);
    return () => window.clearTimeout(t);
  }, [loadNotifications]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void loadNotifications({ silent: true });
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as NotificationMutationResponse;
    setNotifications((cur) => cur.map((n) => (n.id === id ? data.notification : n)));
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => n.unread);
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        })
      )
    );
    setNotifications((cur) => cur.map((n) => ({ ...n, unread: false, readAt: new Date().toISOString() })));
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setNotifications((cur) => cur.filter((n) => n.id !== id));
  }

  async function handleClearAll() {
    const response = await fetch("/api/notifications/clear", { method: "POST" });
    if (!response.ok) return;
    setNotifications([]);
  }

  return (
    <AppShell topAppBarProps={{ rightAction: "back", rightAriaLabel: "返回上一页" }}>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant/70">Mindful</p>
          <h1 className="text-3xl font-[var(--font-display)] text-on-surface">通知中心</h1>
        </header>

        {!loading && !error && notifications.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">
              {unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}
            </span>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="rounded-full border border-outline-variant/30 px-4 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant/20 transition-colors"
                >
                  全部已读
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="rounded-full border border-outline-variant/30 px-4 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant/20 transition-colors"
              >
                清空
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center gap-4">
            <Icon name="notifications_off" size={40} className="text-outline-variant" />
            <p className="text-sm text-on-surface-variant">{error}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => void loadNotifications()} className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm text-on-surface">重试</button>
              <Link href="/login" className="rounded-full bg-secondary px-4 py-2 text-sm text-on-secondary">去登录</Link>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Icon name="notifications_off" size={40} className="text-outline-variant mb-3" />
            <p className="text-on-surface-variant">暂无通知</p>
            <p className="text-xs text-outline mt-1">新提醒出现后会自动出现在这里</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NotificationCard({
  item,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className={`relative rounded-2xl px-4 py-3 mb-1 transition-colors duration-300 ${item.unread ? "bg-secondary-container/25" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1.5 w-2 flex-shrink-0">
          {item.unread && <span className="block w-2 h-2 rounded-full bg-secondary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-on-surface">{item.title}</p>
            <span className="text-xs text-on-surface-variant/60 flex-shrink-0 mt-0.5">
              {formatNotificationTime(item.createdAt)}
            </span>
          </div>
          {item.source && (
            <p className="text-xs text-on-surface-variant/50 mt-0.5">{item.source}</p>
          )}
          <p className="mt-1.5 text-sm text-on-surface-variant leading-relaxed">{item.body}</p>
          <div className="mt-3 flex items-center gap-4">
            {item.actionUrl && (
              <Link
                href={item.actionUrl}
                onClick={() => { if (item.unread) onMarkRead(item.id); }}
                className="text-xs font-medium text-secondary hover:underline"
              >
                查看详情
              </Link>
            )}
            {item.unread && (
              <button
                type="button"
                onClick={() => onMarkRead(item.id)}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                标为已读
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="text-xs text-on-surface-variant/50 hover:text-error transition-colors ml-auto"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
