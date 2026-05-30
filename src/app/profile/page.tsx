"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

interface HealthConnection {
  id: string;
  icon: string;
  name: string;
  connected: boolean;
  type: "toggle" | "button";
}

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  memberSince?: string;
}

const healthConnections: HealthConnection[] = [
  { id: "apple", icon: "favorite", name: "Apple Health", connected: true, type: "toggle" },
  { id: "garmin", icon: "watch", name: "Garmin Connect", connected: false, type: "button" },
  { id: "oura", icon: "radio_button_unchecked", name: "Oura Ring", connected: true, type: "toggle" },
];

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [connections, setConnections] = useState(healthConnections);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  function toggleConnection(id: string) {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, connected: !c.connected } : c))
    );
  }

  async function handleSaveName() {
    if (!user || !newName.trim()) return;
    setSaveLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
    } finally {
      setSaveLoading(false);
      setEditingName(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-screen-md mx-auto">
        {/* Login Entry / Profile Header */}
        <section className="py-12">
          {!user ? (
            /* Not logged in */
            <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-outline">
                  person
                </span>
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
            /* Logged in */
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 glass-panel ambient-shadow relative bg-primary-container">
                <Image
                  src={user.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCu1L5PhcyvXkq-if97lnZrMAo_0or3u9KDmFjRvDiT50M3M-8zyJjqK8EU62PW6jQkW1qoW0oaXuMM1nRHGWeimOOQpKZgfehK-YXk0_aaiyB34NNj_5U7n7S2grOXOf7OFUOUdyo3NK37rC-cgotBgf7frr5AHzFiAvj_DqGJx9s-CeELcS18ZYK6IvgZ-589Lb4-A6CsD69GFJF3KJjWErWGUso1KZ2vSvUR_r2ZXWBCnpduXK8_XspZEPol1gtTSxA5Tw3Nsjw"}
                  alt="Profile Avatar"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex items-center gap-2 mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                      autoFocus
                      className="font-[var(--font-display)] text-3xl font-medium text-on-surface bg-transparent border-b border-on-surface focus:outline-none focus:border-secondary text-center max-w-[200px]"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saveLoading}
                      className="text-sm text-secondary hover:text-on-secondary-container transition-colors"
                    >
                      {saveLoading ? "保存中..." : "保存"}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="text-sm text-outline hover:text-on-surface-variant transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-[var(--font-display)] text-3xl font-medium text-on-surface">
                      {user.name || "未设置昵称"}
                    </h2>
                    <button
                      onClick={() => {
                        setNewName(user.name || "");
                        setEditingName(true);
                      }}
                      className="text-outline hover:text-on-surface-variant transition-colors"
                      aria-label="编辑昵称"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        edit
                      </span>
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-on-surface-variant">
                {user.email}
              </p>
            </div>
          )}
        </section>

        {user && (
          <>
            {/* Personal Information */}
            <section className="mb-6">
              <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
                个人信息
              </h3>
              <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
                <InfoRow label="邮箱" value={user.email} />
                <InfoRow label="昵称" value={user.name || "未设置"} />
                <InfoRow label="性别" value="-" />
                <InfoRow label="生日" value="-" last />
              </div>
            </section>

            {/* Health Connections */}
            <section className="mb-6 pt-8">
              <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
                健康连接
              </h3>
              <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
                {connections.map((conn, index) => (
                  <div
                    key={conn.id}
                    className={`flex justify-between items-center py-4 ${
                      index < connections.length - 1
                        ? "border-b border-on-surface-variant/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined">
                          {conn.icon}
                        </span>
                      </div>
                      <span className="text-lg text-on-surface">{conn.name}</span>
                    </div>
                    {conn.type === "toggle" ? (
                      <button
                        onClick={() => toggleConnection(conn.id)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                          conn.connected ? "bg-secondary" : "bg-surface-variant"
                        }`}
                        aria-label={`Toggle ${conn.name}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 transition-all duration-300 ${
                            conn.connected
                              ? "right-0.5 border-secondary"
                              : "left-0.5 border-outline-variant"
                          }`}
                        />
                      </button>
                    ) : (
                      <button className="text-sm font-medium text-secondary border border-secondary/30 rounded-full px-4 py-1 hover:bg-secondary/5 transition-colors">
                        连接
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Preferences */}
            <section className="mb-32 pt-8">
              <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
                偏好设置
              </h3>
              <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
                <PrefRow icon="notifications" label="通知" />
                <PrefRow icon="lock" label="隐私与安全" last />
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      } group cursor-pointer hover:opacity-70 transition-opacity`}
    >
      <span className="text-lg text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-lg text-on-surface">{value}</span>
        <span className="material-symbols-outlined text-outline text-[18px]">
          chevron_right
        </span>
      </div>
    </div>
  );
}

function PrefRow({
  icon,
  label,
  last = false,
}: {
  icon: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      } group cursor-pointer hover:opacity-70 transition-opacity`}
    >
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-outline">{icon}</span>
        <span className="text-lg text-on-surface">{label}</span>
      </div>
      <span className="material-symbols-outlined text-outline text-[18px]">
        chevron_right
      </span>
    </div>
  );
}
