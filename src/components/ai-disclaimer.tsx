"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

type AiDisclaimerProps = {
  variant?: "inline" | "compact";
  className?: string;
};

export function AiDisclaimer({ variant = "inline", className = "" }: AiDisclaimerProps) {
  const compact = variant === "compact";

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low/70 text-on-surface-variant ${
        compact ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-xs"
      } ${className}`}
    >
      <Icon name="info" size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-outline" />
      <p className="leading-relaxed">
        {compact
          ? "AI 内容可能不准确，不能替代专业医疗建议；紧急情况请及时就医。"
          : "WiTH 是 AI 健康助手，回答和生成内容可能不完全准确，不能替代专业医疗建议。请勿输入高度敏感信息；紧急情况请及时就医。"}
        了解{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2">
          隐私政策
        </Link>
        {" "}与{" "}
        <Link href="/terms" className="text-primary underline underline-offset-2">
          服务条款
        </Link>
        。
      </p>
    </div>
  );
}
