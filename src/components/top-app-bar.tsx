"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface TopAppBarProps {
  title?: string;
  leftIcon?: string;
  rightIcon?: string;
  leftHref?: string;
  rightHref?: string;
  rightAction?: "link" | "back";
  rightAriaLabel?: string;
  backFallbackHref?: string;
  transparent?: boolean;
}

export function TopAppBar({
  title = "Mindful",
  leftIcon = "self_care",
  rightIcon = "notifications",
  leftHref,
  rightHref = "/notifications",
  rightAction = "link",
  rightAriaLabel = "通知中心",
  backFallbackHref = "/",
  transparent = false,
}: TopAppBarProps) {
  const router = useRouter();
  const bgClass = transparent
    ? "bg-transparent"
    : "bg-surface/80 backdrop-blur-xl";

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(backFallbackHref);
  }

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

      <h1 className="font-[var(--font-display)] text-2xl font-medium text-primary tracking-tight">
        {title}
      </h1>

      {rightAction === "back" ? (
        <button
          type="button"
          aria-label={rightAriaLabel}
          onClick={handleBack}
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">{rightIcon}</span>
        </button>
      ) : rightHref ? (
        <Link
          href={rightHref}
          aria-label={rightAriaLabel}
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">{rightIcon}</span>
        </Link>
      ) : (
        <button
          type="button"
          aria-label={rightAriaLabel}
          className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full"
        >
          <span className="material-symbols-outlined">{rightIcon}</span>
        </button>
      )}
    </header>
  );
}
