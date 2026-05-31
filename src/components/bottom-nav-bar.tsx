"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/chat", icon: "chat_bubble", label: "Chat" },
  { href: "/discover", icon: "explore", label: "Discover" },
  // Center voice button is rendered separately
  { href: "/memory", icon: "auto_stories", label: "Memory" },
  { href: "/profile", icon: "person", label: "Profile" },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const [isListening, setIsListening] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === "touchstart") {
      e.preventDefault();
    }
    pressTimerRef.current = setTimeout(() => {
      setIsListening(true);
    }, 500);
  }, []);

  const endPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === "touchend") {
      e.preventDefault();
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsListening(false);
  }, []);

  return (
    <>
      {/* Voice Input Overlay */}
      <div
        className={`fixed top-0 left-0 w-full p-4 z-[60] transition-transform duration-300 ${
          isListening ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="bg-surface/90 backdrop-blur-xl rounded-2xl shadow-lg border border-outline-variant/30 p-6 flex flex-col items-center gap-4">
          <p className="text-base text-on-surface-variant italic">
            正在聆听您的心声...
          </p>
          <div className="flex items-center gap-1 h-8">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-1 bg-secondary rounded-full waveform-bar"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl rounded-t-3xl shadow-[0_-20px_40px_rgba(45,45,45,0.04)] flex justify-between items-center px-4 pb-4 pt-2">
        {/* Left items */}
        {navItems.slice(0, 2).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive
                  ? "text-secondary"
                  : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <span
                className="material-symbols-outlined mb-1"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span className="text-xs font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Center Voice Button */}
        <button
          className={`no-select flex items-center justify-center rounded-full w-14 h-14 -translate-y-4 shadow-lg transition-all duration-300 active:scale-95 flex-shrink-0 ${
            isListening
              ? "bg-secondary-fixed-dim text-on-secondary-fixed"
              : "bg-secondary text-on-secondary"
          }`}
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onTouchCancel={endPress}
          aria-label="Voice input - long press to speak"
        >
          <span
            className="material-symbols-outlined text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mic
          </span>
        </button>

        {/* Right items */}
        {navItems.slice(2).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 transition-colors duration-300 active:scale-90 ${
                isActive
                  ? "text-secondary"
                  : "text-on-surface-variant/70 hover:text-secondary scale-95"
              }`}
            >
              <span
                className="material-symbols-outlined mb-1"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span className="text-xs font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
