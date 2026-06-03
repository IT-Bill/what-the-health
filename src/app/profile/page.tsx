"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { PrimaryGoalSelectorDialog } from "@/components/primary-goal-selector-dialog";
import {
  getPrimaryGoalLabels,
  hasStoredPrimaryGoals,
  requiresPrimaryGoalParameters,
} from "@/lib/primary-goals";
import { useUser } from "@/lib/swr";

interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
  memberSince?: string;
  gender?: string;
  birthday?: string;
  heightCm?: number;
  weightKg?: number;
  primaryGoal?: string | null;
  primaryGoals?: string[];
}

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { id: "personal", icon: "person", label: "个人信息", href: "/profile/personal-info" },
  { id: "favorites", icon: "bookmark", label: "我的收藏", href: "/profile/favorites" },
  { id: "health", icon: "watch", label: "健康连接", href: "/profile/health-connections" },
  { id: "health-data", icon: "health_metrics", label: "健康数据", href: "/profile/health-data" },
  { id: "prefs", icon: "settings", label: "偏好设置", href: "/profile/preferences" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { data: userData, isLoading } = useUser();
  const user = userData?.user ?? null;
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  useEffect(() => {
    if (user && !hasStoredPrimaryGoals(user.primaryGoals, user.primaryGoal)) {
      setGoalDialogOpen(true);
    }
  }, [user]);

  const primaryGoalLabels = user
    ? getPrimaryGoalLabels(user.primaryGoals, user.primaryGoal)
    : [];

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-screen-md mx-auto py-12 flex justify-center">
          <span className="text-on-surface-variant">加载中...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-screen-md mx-auto">
        {/* Profile Header */}
        <section className="py-12">
          {!user ? (
            <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
                <Icon name="person" className="text-4xl text-outline" />
              </div>
              <div className="space-y-2">
                <h2 className="font-[var(--font-display)] text-2xl font-medium text-on-surface">
                  欢迎来到您的宁静港湾
                </h2>
                <p className="text-base text-on-surface-variant leading-relaxed">
                  登录以同步您的健康数据，继续心灵之旅。
                </p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-2">
                <Link
                  href="/login"
                  className="w-full flex justify-center items-center py-3.5 px-8 rounded-full text-sm font-medium tracking-wide text-on-primary bg-inverse-surface hover:bg-on-background transition-all duration-300"
                >
                  登录
                </Link>
                <p className="text-sm text-on-surface-variant">
                  还没有账号？
                  <Link
                    href="/signup"
                    className="font-medium text-primary hover:text-secondary underline decoration-1 underline-offset-4 transition-colors duration-300 ml-1"
                  >
                    立即注册
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5 py-8 px-4">
              <img
                src={user.avatarUrl || "https://api.dicebear.com/10.x/notionists-neutral/svg?seed=Felix"}
                alt="Profile Avatar"
                className="w-16 h-16 rounded-full glass-panel ambient-shadow bg-primary-container object-cover shrink-0"
              />
              <div className="flex flex-col gap-1">
                <h2 className="[font-family:var(--font-display)] text-xl font-medium text-on-surface">
                  {user.name || "未设置昵称"}
                </h2>
                <div className="mt-1 flex flex-wrap gap-2">
                  {primaryGoalLabels.length > 0 ? (
                    primaryGoalLabels.map((goal) => (
                      <span
                        key={goal}
                        className="rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container"
                      >
                        {goal}
                      </span>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGoalDialogOpen(true)}
                      className="rounded-full bg-primary-container px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
                    >
                      设置主要目标
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.username ?? "");
                    alert("已复制用户名: @" + (user.username ?? ""));
                  }}
                  className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-secondary transition-colors self-start"
                >
                  <span>@{user.username}</span>
                  <Icon name="content_copy" />
                </button>
              </div>
            </div>
          )}
        </section>

        {user && (
          <section className="mb-32">
            <div className="bg-primary-container rounded-[2rem] p-2 ambient-shadow flex flex-col">
              {menuItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center justify-between py-5 px-6 transition-opacity hover:opacity-70 ${
                    index < menuItems.length - 1
                      ? "border-b border-on-surface-variant/10"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon name={item.icon} className="text-outline" size={20} />
                    <span className="text-lg text-on-surface">{item.label}</span>
                  </div>
                  <Icon name="chevron_right" className="text-outline text-[18px]" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      {user ? (
        <PrimaryGoalSelectorDialog
          open={goalDialogOpen}
          userId={user.id}
          initialValue={user.primaryGoals}
          fallbackPrimaryGoal={user.primaryGoal ?? null}
          required={!hasStoredPrimaryGoals(user.primaryGoals, user.primaryGoal)}
          description="可多选。我们会根据这些方向个性化推荐内容、习惯和陪伴方式。"
          onClose={() => setGoalDialogOpen(false)}
          onSaved={(selection) => {
            if (requiresPrimaryGoalParameters(selection.primaryGoals, selection.primaryGoal)) {
              router.push("/profile/personal-info?next=goal-params");
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}
