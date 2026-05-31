"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface PrefItem {
  id: string;
  icon: string;
  label: string;
  type: "toggle" | "link";
  href?: string;
}

const prefItems: PrefItem[] = [
  { id: "notifications", icon: "notifications", label: "通知", type: "toggle" },
  { id: "privacy", icon: "lock", label: "隐私与安全", type: "link", href: "#" },
  { id: "language", icon: "language", label: "语言", type: "link", href: "#" },
];

export default function PreferencesPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notifications: true,
  });

  function toggleItem(id: string) {
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="偏好设置" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full">
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          {prefItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between py-5 ${
                index < prefItems.length - 1
                  ? "border-b border-on-surface-variant/10"
                  : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <Icon name={item.icon} className="text-outline" size={20} />
                <span className="text-lg text-on-surface">{item.label}</span>
              </div>
              {item.type === "toggle" ? (
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                    toggles[item.id] ? "bg-secondary" : "bg-surface-variant"
                  }`}
                  aria-label={`Toggle ${item.label}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 transition-all duration-300 ${
                      toggles[item.id]
                        ? "right-0.5 border-secondary"
                        : "left-0.5 border-outline-variant"
                    }`}
                  />
                </button>
              ) : (
                <Link
                  href={item.href || "#"}
                  className="flex items-center text-on-surface-variant hover:opacity-70 transition-opacity"
                >
                  <Icon name="chevron_right" className="text-[18px]" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
      <Link
        href="/profile"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center w-10 h-10 rounded-full"
      >
        <Icon name="arrow_back" />
      </Link>
      <h1 className="font-[var(--font-display)] text-xl font-medium text-on-surface flex-1 text-center px-4">
        {title}
      </h1>
      <Link
        href="/notifications"
        aria-label="通知中心"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center w-10 h-10 rounded-full"
      >
        <Icon name="notifications" />
      </Link>
    </header>
  );
}
