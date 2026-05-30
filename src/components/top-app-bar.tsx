"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface TopAppBarProps {
  title?: string;
  leftIcon?: string;
  leftHref?: string;
  transparent?: boolean;
}

export function TopAppBar({
  title = "Mindful",
  leftIcon = "self_care",
  leftHref,
  transparent = false,
}: TopAppBarProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications?unread=true&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.unreadCount) setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  const bgClass = transparent
    ? "bg-transparent"
    : "bg-surface/80 backdrop-blur-xl";

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 md:px-16 h-16 ${bgClass} transition-all duration-300`}
    >
      {leftHref ? (
        <Link
          href={leftHref}
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">{leftIcon}</span>
        </Link>
      ) : (
        <button
          aria-label="Menu"
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">{leftIcon}</span>
        </button>
      )}

      <h1 className="[font-family:var(--font-display)] text-2xl font-medium text-primary tracking-tight">
        {title}
      </h1>

      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <Link
          href="/notifications"
          className="relative text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </div>
    </header>
  );
}
