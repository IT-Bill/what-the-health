"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import {
  PRIMARY_GOAL_OPTIONS,
  getStoredPrimaryGoals,
  requiresPrimaryGoalParameters,
  type PrimaryGoalId,
} from "@/lib/primary-goals";
import { useUser } from "@/lib/swr";

export default function OnboardingGoalPage() {
  const router = useRouter();
  const { data: userData, isLoading } = useUser();
  const user = userData?.user ?? null;
  const [selectedGoals, setSelectedGoals] = useState<PrimaryGoalId[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setSelectedGoals(getStoredPrimaryGoals(user.primaryGoals, user.primaryGoal));
    }
  }, [user]);

  function toggleGoal(goalId: PrimaryGoalId) {
    setSelectedGoals((current) =>
      current.includes(goalId)
        ? current.filter((value) => value !== goalId)
        : [...current, goalId],
    );
  }

  async function handleSubmit() {
    if (!user?.id || selectedGoals.length === 0) {
      setError("请至少选择一个目标。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, primaryGoals: selectedGoals }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存失败，请稍后重试。");
        return;
      }

      const nextPath = requiresPrimaryGoalParameters(selectedGoals, null)
        ? "/profile/personal-info?next=goal-params"
        : "/profile/personal-info";
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="text-on-surface-variant">加载中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface pb-32">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-surface px-6 py-4">
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="text-outline hover:opacity-80 transition-opacity p-2 rounded-full"
        >
          <Icon name="close" />
        </button>
        <h1 className="font-[var(--font-display)] text-2xl font-medium text-primary absolute left-1/2 -translate-x-1/2">
          WiTH
        </h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 md:px-12 pt-10 md:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[var(--font-display)] text-3xl md:text-5xl font-medium text-on-surface">
            选择你的主要目标
          </h2>
          <p className="mt-4 text-base md:text-lg leading-8 text-on-surface-variant">
            参考这个方向，我们会为你准备更贴近当下状态的内容与建议。支持多选。
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4 md:gap-6">
          {PRIMARY_GOAL_OPTIONS.map((goal) => {
            const selected = selectedGoals.includes(goal.id);

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                className={`relative flex min-h-44 flex-col rounded-[1.75rem] border p-5 text-left transition-all duration-300 md:min-h-52 md:p-6 ${
                  selected
                    ? "border-secondary bg-secondary-container"
                    : "border-transparent bg-primary-container hover:bg-surface-container-low"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-sm md:h-14 md:w-14">
                  <Icon name={goal.icon} size={26} />
                </div>
                <h3 className="mt-6 font-[var(--font-display)] text-lg md:text-xl font-medium text-on-surface">
                  {goal.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {goal.description}
                </p>
                <span
                  className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border text-white ${
                    selected
                      ? "border-secondary bg-secondary"
                      : "border-outline-variant bg-transparent text-transparent"
                  }`}
                >
                  <Icon name="check" size={14} />
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-error">{error}</p>
        ) : null}
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-between border-t border-outline-variant/30 bg-surface/85 px-6 py-4 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex flex-col items-center justify-center px-6 py-2 text-sm font-medium text-on-surface-variant hover:opacity-80 transition-opacity"
        >
          <Icon name="arrow_back" />
          返回
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || selectedGoals.length === 0}
          className="flex flex-col items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary transition-all duration-300 hover:bg-primary/90 disabled:opacity-50"
        >
          <Icon name="arrow_forward" />
          {saving ? "保存中" : "完成"}
        </button>
      </nav>
    </div>
  );
}
