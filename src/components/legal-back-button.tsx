"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

export function LegalBackButton({ fallbackHref = "/profile" }: { fallbackHref?: string }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high"
      aria-label="返回"
    >
      <Icon name="arrow_back" />
    </button>
  );
}
