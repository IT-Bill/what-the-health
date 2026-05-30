"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  name: string;
  gender?: string;
  birthday?: string;
  heightCm?: number;
  weightKg?: number;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<User>>({});

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setForm({
            name: data.user.name || "",
            gender: data.user.gender || "",
            birthday: formatDateForInput(data.user.birthday),
            heightCm: data.user.heightCm ?? undefined,
            weightKg: data.user.weightKg ?? undefined,
          });
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

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
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
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

  if (loading) {
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
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          <InfoField
            label="邮箱"
            value={user.username}
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
            last
            onChange={(v) => handleChange("weightKg", v ? parseFloat(v) : "")}
          />
        </div>

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
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 h-16">
      <Link
        href="/profile"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full -ml-2"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <h1 className="font-[var(--font-display)] text-xl font-medium text-on-surface ml-2">
        {title}
      </h1>
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
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  suffix?: string;
  readOnly?: boolean;
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
      <div className="flex items-center gap-2 flex-1 justify-end">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
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
