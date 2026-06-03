"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { PrimaryGoalSelectorDialog } from "@/components/primary-goal-selector-dialog";
import {
  ACTIVITY_GOAL_IDS,
  BODY_COMPOSITION_GOAL_IDS,
  getPrimaryGoalLabels,
  hasPrimaryGoalGroup,
  requiresPrimaryGoalParameters,
} from "@/lib/primary-goals";
import { useUser } from "@/lib/swr";

interface User {
  id: string;
  username: string;
  name: string;
  gender?: string;
  birthday?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  targetBodyFatPct?: number;
  dailyActiveCalories?: number;
  dailyExerciseMinutes?: number;
  dailyStepGoal?: number;
  dailyActiveHours?: number;
  primaryGoal?: string | null;
  primaryGoals?: string[];
}

const genderOptions = [
  { value: "", label: "未设置" },
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "nonBinary", label: "非二元性别" },
  { value: "undisclosed", label: "不愿透露" },
];

function formatDateForInput(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export default function PersonalInfoPage() {
  const router = useRouter();
  const { data: userData, isLoading } = useUser();
  const user = userData?.user ?? null;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<User>>({});
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalParameterStepActive, setGoalParameterStepActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextStep = new URLSearchParams(window.location.search).get("next");
    setGoalParameterStepActive(nextStep === "goal-params");
  }, []);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        gender: user.gender || "",
        birthday: formatDateForInput(user.birthday ?? undefined),
        heightCm: user.heightCm ?? undefined,
        weightKg: user.weightKg ?? undefined,
        targetWeightKg: user.targetWeightKg ?? undefined,
        targetBodyFatPct: user.targetBodyFatPct ?? undefined,
        dailyActiveCalories: user.dailyActiveCalories ?? undefined,
        dailyExerciseMinutes: user.dailyExerciseMinutes ?? undefined,
        dailyStepGoal: user.dailyStepGoal ?? undefined,
        dailyActiveHours: user.dailyActiveHours ?? undefined,
      });
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name: form.name,
          gender: form.gender || null,
          birthday: form.birthday || null,
          heightCm: form.heightCm ?? null,
          weightKg: form.weightKg ?? null,
          targetWeightKg: form.targetWeightKg ?? null,
          targetBodyFatPct: form.targetBodyFatPct ?? null,
          dailyActiveCalories: form.dailyActiveCalories ?? null,
          dailyExerciseMinutes: form.dailyExerciseMinutes ?? null,
          dailyStepGoal: form.dailyStepGoal ?? null,
          dailyActiveHours: form.dailyActiveHours ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setGoalParameterStepActive(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: keyof User, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const primaryGoalLabels = user
    ? getPrimaryGoalLabels(user.primaryGoals, user.primaryGoal)
    : [];
  const showBodyCompositionFields = user
    ? hasPrimaryGoalGroup(user.primaryGoals, user.primaryGoal, BODY_COMPOSITION_GOAL_IDS)
    : false;
  const showActivityFields = user
    ? hasPrimaryGoalGroup(user.primaryGoals, user.primaryGoal, ACTIVITY_GOAL_IDS)
    : false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <Header title="个人信息" />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-on-surface-variant">加载中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <Header title="个人信息" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <span className="text-on-surface-variant">请先登录</span>
          <Link
            href="/login"
            className="text-sm font-medium text-secondary hover:text-on-secondary-container transition-colors"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="个人信息" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full">
        {goalParameterStepActive && (showBodyCompositionFields || showActivityFields) ? (
          <section className="mb-4 rounded-[1.5rem] border border-secondary/20 bg-secondary-container/70 p-4 text-sm text-on-secondary-container">
            下一步：请先填写下面的目标参数，再点击保存。这样系统才能根据你的主要目标提供更准确的建议。
          </section>
        ) : null}

        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          <InfoField
            label="邮箱"
            value={user.username ?? ""}
            readOnly
            onChange={() => {}}
          />
          <InfoField
            label="昵称"
            value={form.name || ""}
            placeholder="未设置昵称"
            onChange={(v) => handleChange("name", v)}
          />
          <InfoSelect
            label="性别"
            value={form.gender || ""}
            options={genderOptions}
            onChange={(v) => handleChange("gender", v)}
          />
          <InfoField
            label="生日"
            type="date"
            value={form.birthday || ""}
            onChange={(v) => handleChange("birthday", v)}
          />
          <InfoField
            label="身高"
            type="number"
            value={form.heightCm?.toString() || ""}
            placeholder="cm"
            suffix="cm"
            onChange={(v) => handleChange("heightCm", v ? parseInt(v, 10) : "")}
          />
          <InfoField
            label="体重"
            type="number"
            value={form.weightKg?.toString() || ""}
            placeholder="kg"
            suffix="kg"
            onChange={(v) => handleChange("weightKg", v ? parseFloat(v) : "")}
          />
          {showBodyCompositionFields ? (
            <>
              <InfoField
                label="目标体重"
                type="number"
                value={form.targetWeightKg?.toString() || ""}
                placeholder="kg"
                suffix="kg"
                autoFocus={goalParameterStepActive}
                onChange={(v) => handleChange("targetWeightKg", v ? parseFloat(v) : "")}
              />
              <InfoField
                label="目标体脂"
                type="number"
                value={form.targetBodyFatPct?.toString() || ""}
                placeholder="%"
                suffix="%"
                last={!showActivityFields}
                onChange={(v) => handleChange("targetBodyFatPct", v ? parseFloat(v) : "")}
              />
            </>
          ) : null}
          {showActivityFields ? (
            <>
              <InfoField
                label="活动热量"
                type="number"
                value={form.dailyActiveCalories?.toString() || ""}
                placeholder="kcal"
                suffix="kcal"
                autoFocus={goalParameterStepActive && !showBodyCompositionFields}
                onChange={(v) => handleChange("dailyActiveCalories", v ? parseInt(v, 10) : "")}
              />
              <InfoField
                label="运动时间"
                type="number"
                value={form.dailyExerciseMinutes?.toString() || ""}
                placeholder="min"
                suffix="min"
                onChange={(v) => handleChange("dailyExerciseMinutes", v ? parseInt(v, 10) : "")}
              />
              <InfoField
                label="每日步数"
                type="number"
                value={form.dailyStepGoal?.toString() || ""}
                placeholder="steps"
                suffix="步"
                onChange={(v) => handleChange("dailyStepGoal", v ? parseInt(v, 10) : "")}
              />
              <InfoField
                label="活动小时"
                type="number"
                value={form.dailyActiveHours?.toString() || ""}
                placeholder="h"
                suffix="h"
                last
                onChange={(v) => handleChange("dailyActiveHours", v ? parseFloat(v) : "")}
              />
            </>
          ) : null}
          {!showBodyCompositionFields && !showActivityFields ? (
            <div className="py-4 text-sm text-on-surface-variant">
              选择“减重管理 / 增肌塑形”或“健康习惯 / 每日活动”后，会显示对应目标参数。
            </div>
          ) : null}
        </div>

        <section className="mt-4 rounded-[2rem] bg-primary-container p-6 ambient-shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-medium text-on-surface">主要目标</h2>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                登录后的推荐内容、习惯建议和陪伴风格会参考这些目标。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGoalDialogOpen(true)}
              className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              编辑
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {primaryGoalLabels.length > 0 ? (
              primaryGoalLabels.map((goal) => (
                <span
                  key={goal}
                  className="rounded-full bg-secondary-container px-3 py-1.5 text-sm font-medium text-on-secondary-container"
                >
                  {goal}
                </span>
              ))
            ) : (
              <span className="text-sm text-on-surface-variant">未设置</span>
            )}
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 flex justify-center py-4 px-8 rounded-full text-sm font-medium tracking-wide text-on-primary bg-inverse-surface hover:bg-on-background transition-all duration-300 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>

        <button
          onClick={handleLogout}
          className="w-full mt-4 flex justify-center py-4 px-8 rounded-full text-sm font-medium tracking-wide text-error bg-transparent hover:bg-error/5 transition-all duration-300"
        >
          退出登录
        </button>
      </main>

      {user ? (
        <PrimaryGoalSelectorDialog
          open={goalDialogOpen}
          userId={user.id}
          initialValue={user.primaryGoals}
          fallbackPrimaryGoal={user.primaryGoal ?? null}
          title="编辑主要目标"
          description="可多选，保存后会立即同步到你的个人资料。"
          onClose={() => setGoalDialogOpen(false)}
          onSaved={(selection) => {
            setGoalParameterStepActive(
              requiresPrimaryGoalParameters(selection.primaryGoals, selection.primaryGoal),
            );
          }}
        />
      ) : null}
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
        <Icon name="notifications" size={24} />
      </Link>
    </header>
  );
}

function InfoField({
  label,
  value,
  placeholder,
  type = "text",
  suffix,
  readOnly = false,
  last = false,
  autoFocus = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  suffix?: string;
  readOnly?: boolean;
  last?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      }`}
    >
      <span className="text-base text-on-surface-variant min-w-[4rem]">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          className={`text-base text-on-surface bg-transparent text-right focus:outline-none w-full max-w-[200px] ${
            readOnly ? "opacity-60 cursor-default" : "border-b border-transparent focus:border-secondary"
          }`}
        />
        {suffix && (
          <span className="text-sm text-on-surface-variant">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function InfoSelect({
  label,
  value,
  options,
  last = false,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  last?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      }`}
    >
      <span className="text-base text-on-surface-variant min-w-[4rem]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base text-on-surface bg-transparent text-right focus:outline-none border-b border-transparent focus:border-secondary cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
