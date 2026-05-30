"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  icon: string | null;
  refType: string | null;
  refId: string | null;
  read: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  } | null;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  system: { icon: "info", color: "text-primary" },
  friendRequest: { icon: "person_add", color: "text-secondary" },
  friendActivity: { icon: "emoji_events", color: "text-tertiary" },
  creditEarned: { icon: "stars", color: "text-secondary" },
  reportReady: { icon: "analytics", color: "text-primary" },
  aiInsight: { icon: "psychology", color: "text-tertiary" },
  reminder: { icon: "alarm", color: "text-on-surface-variant" },
  leaderboard: { icon: "leaderboard", color: "text-secondary" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 }))
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function dismissNotification(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function getNotificationHref(n: NotificationItem): string | null {
    if (!n.refType || !n.refId) return null;
    switch (n.refType) {
      case "post": return `/discover/${n.refId}`;
      case "report": return "/memory";
      case "friend": return "/profile/friends";
      case "product": return "/discover";
      case "insight": return "/memory";
      default: return null;
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
        <Link
          href="/"
          className="text-on-surface hover:opacity-70 transition-opacity flex items-center p-2 rounded-full -ml-2"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="[font-family:var(--font-display)] text-xl font-medium text-on-surface">
          通知
        </h1>
        {unreadCount > 0 ? (
          <button
            onClick={markAllRead}
            className="text-xs font-medium text-secondary hover:opacity-70 transition-opacity"
          >
            全部已读
          </button>
        ) : (
          <div className="w-14" />
        )}
      </header>

      <main className="flex-1 px-6 py-4 max-w-screen-md mx-auto w-full">
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-primary-container rounded-2xl h-20" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-4 block">notifications_none</span>
            <p className="text-lg">暂无通知</p>
            <p className="text-sm mt-1">有新消息时会在这里提醒你</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const typeInfo = TYPE_ICONS[n.type] || { icon: "circle_notifications", color: "text-on-surface-variant" };
              const href = getNotificationHref(n);

              const content = (
                <div
                  className={`flex items-start gap-3 p-4 rounded-2xl transition-all duration-300 ${
                    n.read
                      ? "bg-surface-container-low"
                      : "bg-primary-container ambient-shadow"
                  }`}
                >
                  {/* Icon or sender avatar */}
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {n.sender?.avatarUrl ? (
                      <Image src={n.sender.avatarUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`material-symbols-outlined ${typeInfo.color}`}>
                        {n.icon || typeInfo.icon}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${n.read ? "text-on-surface-variant" : "text-on-surface"}`}>
                      {n.sender && (
                        <span className="font-medium">{n.sender.name} </span>
                      )}
                      {n.message}
                    </p>
                    <p className="text-[10px] text-outline mt-1">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.read && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(n.id); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/30 transition-colors"
                        title="标记已读"
                      >
                        <span className="material-symbols-outlined text-sm">done</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissNotification(n.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/30 transition-colors"
                      title="忽略"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-secondary flex-shrink-0 mt-2" />
                  )}
                </div>
              );

              return href ? (
                <Link key={n.id} href={href} onClick={() => !n.read && markAsRead(n.id)}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
