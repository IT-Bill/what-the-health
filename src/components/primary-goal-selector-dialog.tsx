"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import {
  PRIMARY_GOAL_OPTIONS,
  getStoredPrimaryGoals,
  requiresPrimaryGoalParameters,
  type PrimaryGoalId,
} from "@/lib/primary-goals";

interface SavedGoalSelection {
  primaryGoal: string | null;
  primaryGoals: PrimaryGoalId[];
}

interface PrimaryGoalSelectorDialogProps {
  open: boolean;
  userId: string;
  initialValue?: readonly string[] | null;
  fallbackPrimaryGoal?: string | null;
  required?: boolean;
  title?: string;
  description?: string;
  onClose?: () => void;
  onSaved: (selection: SavedGoalSelection) => void;
}

export function PrimaryGoalSelectorDialog({
  open,
  userId,
  initialValue,
  fallbackPrimaryGoal,
  required = false,
  title = "选择你的主要目标",
  description = "可多选。我们会根据这些方向个性化推荐内容、习惯和陪伴方式。",
  onClose,
  onSaved,
}: PrimaryGoalSelectorDialogProps) {
  const [selectedGoals, setSelectedGoals] = useState<PrimaryGoalId[]>(
    getStoredPrimaryGoals(initialValue, fallbackPrimaryGoal),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedGoalsNeedParameters = requiresPrimaryGoalParameters(selectedGoals, null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedGoals(getStoredPrimaryGoals(initialValue, fallbackPrimaryGoal));
    setError("");
  }, [fallbackPrimaryGoal, initialValue, open]);

  function toggleGoal(goalId: PrimaryGoalId) {
    setSelectedGoals((current) =>
      current.includes(goalId)
        ? current.filter((value) => value !== goalId)
        : [...current, goalId],
    );
  }

  async function handleSave() {
    if (selectedGoals.length === 0) {
      setError("请至少选择一个目标。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, primaryGoals: selectedGoals }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存目标失败，请稍后重试。");
        return;
      }

      onSaved({
        primaryGoal: data.user.primaryGoal ?? null,
        primaryGoals: getStoredPrimaryGoals(data.user.primaryGoals, data.user.primaryGoal),
      });
      onClose?.();
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-on-surface/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-6 sm:py-6">
      <div className="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-t-[2rem] bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-[var(--font-display)] text-2xl font-medium text-on-surface sm:text-3xl">
              {title}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              {description}
            </p>
          </div>
          {!required && onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="flex h-10 w-10 items-center justify-center rounded-full text-outline transition-opacity hover:opacity-70"
            >
              <Icon name="close" />
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {PRIMARY_GOAL_OPTIONS.map((goal) => {
            const selected = selectedGoals.includes(goal.id);

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                className={`relative flex min-h-40 flex-col items-start rounded-[1.75rem] border p-5 text-left transition-all duration-300 ${
                  selected
                    ? "border-secondary bg-secondary-container"
                    : "border-transparent bg-primary-container hover:bg-surface-container-low"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
                  <Icon name={goal.icon} size={24} />
                </div>
                <p className="mt-5 font-[var(--font-display)] text-lg font-medium text-on-surface">
                  {goal.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {goal.description}
                </p>
                <span
                  className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border text-white transition-all ${
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
          <p className="mt-4 text-sm text-error">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-5">
          <p className="text-sm text-on-surface-variant">
            已选择 {selectedGoals.length} 项
          </p>
          <div className="flex gap-3">
            {!required && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                取消
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {saving
                ? "保存中..."
                : required && selectedGoalsNeedParameters
                  ? "下一步：填写参数"
                  : required
                    ? "开始体验"
                    : "保存目标"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}