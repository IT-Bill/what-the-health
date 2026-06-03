"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import type { ReminderFrequency } from "@/generated/prisma/client";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  frequency: ReminderFrequency;
  reminderTimes: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastRemindedAt: string | null;
  createdAt: string;
}

const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  daily: "每天",
  twice_daily: "每天两次",
  three_times_daily: "每天三次",
  weekly: "每周",
  custom: "自定义",
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  async function toggleReminder(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r))
        );
      }
    } catch {
      // ignore
    }
  }

  async function deleteReminder(id: string) {
    if (!confirm("确定要删除这个提醒吗？")) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // ignore
    }
  }

  return (
    <AppShell
      topAppBarProps={{
        title: "我的提醒",
        leftIcon: "arrow_left",
        leftHref: "/chat",
        rightIcon: "notifications",
        rightHref: "/notifications",
      }}
    >
      <div className="max-w-screen-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-6">
          <div>
            <h2 className="text-xl font-medium text-on-surface">提醒管理</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              设置用药、监测和复诊提醒
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Icon name="plus" size={16} />
            新增
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <ReminderForm
            onSaved={() => {
              setShowForm(false);
              void fetchReminders();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-on-surface-variant">加载中...</div>
        ) : reminders.length === 0 ? (
          <EmptyState onAdd={() => setShowForm(true)} />
        ) : (
          <div className="flex flex-col gap-3">
            {reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onToggle={() => toggleReminder(reminder.id, reminder.isActive)}
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ReminderCard({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`bg-primary-container rounded-2xl p-4 ambient-shadow flex flex-col gap-3 ${
        !reminder.isActive ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-on-surface truncate">
              {reminder.title}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
              {FREQUENCY_LABELS[reminder.frequency]}
            </span>
          </div>
          {reminder.description && (
            <p className="text-sm text-on-surface-variant mt-0.5">
              {reminder.description}
            </p>
          )}
          <p className="text-xs text-on-surface-variant/70 mt-1">
            提醒时间：{reminder.reminderTimes.join("、")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              reminder.isActive ? "bg-secondary" : "bg-surface-variant"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                reminder.isActive ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-on-surface-variant/60">
          {reminder.lastRemindedAt
            ? `上次提醒：${new Date(reminder.lastRemindedAt).toLocaleDateString("zh-CN")}`
            : "尚未提醒"}
        </span>
        <button
          onClick={onDelete}
          className="text-on-surface-variant/50 hover:text-error transition-colors p-1"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    </div>
  );
}

function ReminderForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<ReminderFrequency>("daily");
  const [time1, setTime1] = useState("08:00");
  const [time2, setTime2] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const reminderTimes = [time1];
    if (frequency === "twice_daily" && time2) reminderTimes.push(time2);
    if (frequency === "three_times_daily" && time2) {
      reminderTimes.push(time2);
      reminderTimes.push(
        new Date(`2000-01-01T${time2}`).getHours() >= 12 ? "20:00" : "14:00"
      );
    }

    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          frequency,
          reminderTimes,
        }),
      });
      if (res.ok) {
        onSaved();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/20 mb-6"
    >
      <h3 className="text-base font-medium text-on-surface mb-4">新增提醒</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-on-surface-variant mb-1 block">
            提醒内容
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：降压药、测血压、复诊..."
            className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant border-0 focus:ring-1 focus:ring-secondary"
            required
          />
        </div>

        <div>
          <label className="text-sm text-on-surface-variant mb-1 block">
            补充说明（可选）
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：每次1片、空腹服用..."
            className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant border-0 focus:ring-1 focus:ring-secondary"
          />
        </div>

        <div>
          <label className="text-sm text-on-surface-variant mb-1 block">
            频率
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ReminderFrequency)}
            className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface border-0 focus:ring-1 focus:ring-secondary"
          >
            <option value="daily">每天一次</option>
            <option value="twice_daily">每天两次</option>
            <option value="three_times_daily">每天三次</option>
            <option value="weekly">每周</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm text-on-surface-variant mb-1 block">
              提醒时间 1
            </label>
            <input
              type="time"
              value={time1}
              onChange={(e) => setTime1(e.target.value)}
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface border-0 focus:ring-1 focus:ring-secondary"
            />
          </div>
          {(frequency === "twice_daily" || frequency === "three_times_daily") && (
            <div className="flex-1">
              <label className="text-sm text-on-surface-variant mb-1 block">
                提醒时间 2
              </label>
              <input
                type="time"
                value={time2}
                onChange={(e) => setTime2(e.target.value)}
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface border-0 focus:ring-1 focus:ring-secondary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-full border border-outline-variant/40 text-sm font-medium text-on-surface-variant hover:bg-surface-variant/20 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex-1 py-3 rounded-full bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="calendar" className="text-4xl text-outline-variant mb-4" />
      <p className="text-lg text-on-surface-variant">还没有设置提醒</p>
      <p className="text-sm text-outline mt-2 mb-6">
        添加用药、监测或复诊提醒，Mindful 会准时提醒你
      </p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-full bg-secondary text-on-secondary font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        <Icon name="plus" size={16} />
        添加第一个提醒
      </button>
    </div>
  );
}
