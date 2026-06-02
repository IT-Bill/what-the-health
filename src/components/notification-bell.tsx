"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";

const POLL_INTERVAL_MS = 30 * 1000;

export function NotificationBell({ className }: { className?: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.notifications ?? []).filter((n: { unread: boolean }) => n.unread).length;
        setUnread(count);
      } catch {
        // ignore
      }
    }

    void fetchUnread();
    const timer = setInterval(fetchUnread, POLL_INTERVAL_MS);
    const onFocus = () => void fetchUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label="通知中心"
      className={`relative flex items-center justify-center w-10 h-10 rounded-full bg-primary-container text-primary hover:bg-primary-container/80 transition-colors ${className ?? ""}`}
    >
      <Icon name="notifications" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-medium flex items-center justify-center leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
