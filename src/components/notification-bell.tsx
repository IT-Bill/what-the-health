"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { useNotifications } from "@/lib/swr";

const POLL_INTERVAL_MS = 30 * 1000;

export function NotificationBell({ className }: { className?: string }) {
  const { data } = useNotifications({ refreshInterval: POLL_INTERVAL_MS });
  const unread = (data?.notifications ?? []).filter((n) => n.unread).length;

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
