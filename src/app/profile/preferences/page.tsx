"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { AGENT_ROLES, type AgentRole, DEFAULT_AGENT_ROLE } from "@/lib/agent-role";

interface User {
  id: string;
  agentRole?: string | null;
}

interface PrefItem {
  id: string;
  icon: string;
  label: string;
  type: "toggle" | "link";
  href?: string;
}

const prefItems: PrefItem[] = [
  { id: "notifications", icon: "notifications", label: "通知", type: "toggle" },
  { id: "privacy", icon: "lock", label: "隐私与安全", type: "link", href: "#" },
  { id: "language", icon: "language", label: "语言", type: "link", href: "#" },
];

export default function PreferencesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<AgentRole>(DEFAULT_AGENT_ROLE);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notifications: true,
  });

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.agentRole) {
            setSelectedRole(data.user.agentRole as AgentRole);
          }
        }
      })
      .catch(console.error);
  }, []);

  function toggleItem(id: string) {
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleRoleChange(role: AgentRole) {
    if (role === selectedRole || !user) return;
    setSelectedRole(role);
    setSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, agentRole: role }),
      });
      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="偏好设置" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full flex flex-col gap-6">
        {/* General Preferences */}
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          {prefItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between py-5 ${
                index < prefItems.length - 1
                  ? "border-b border-on-surface-variant/10"
                  : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <Icon name={item.icon} className="text-outline" size={20} />
                <span className="text-lg text-on-surface">{item.label}</span>
              </div>
              {item.type === "toggle" ? (
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                    toggles[item.id] ? "bg-secondary" : "bg-surface-variant"
                  }`}
                  aria-label={`Toggle ${item.label}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 transition-all duration-300 ${
                      toggles[item.id]
                        ? "right-0.5 border-secondary"
                        : "left-0.5 border-outline-variant"
                    }`}
                  />
                </button>
              ) : (
                <Link
                  href={item.href || "#"}
                  className="flex items-center text-on-surface-variant hover:opacity-70 transition-opacity"
                >
                  <Icon name="chevron_right" className="text-[18px]" />
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* AI Companion Role Selection */}
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-on-surface">AI 陪伴风格</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                选择你喜欢的对话风格，新对话将生效
              </p>
            </div>
            {saving && (
              <span className="text-xs text-on-surface-variant">保存中...</span>
            )}
            {saveStatus === "success" && (
              <span className="text-xs text-secondary">已保存</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-error">保存失败</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {AGENT_ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role.id)}
                  disabled={saving}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                    isSelected
                      ? "border-secondary bg-secondary-container/50"
                      : "border-transparent bg-surface-container hover:bg-surface-container-high"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-secondary" : "bg-surface-container-high"
                    }`}
                  >
                    <Icon
                      name={role.icon}
                      size={20}
                      className={isSelected ? "text-on-secondary" : "text-outline"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          isSelected ? "text-on-secondary-container" : "text-on-surface"
                        }`}
                      >
                        {role.name}
                      </span>
                      {isSelected && (
                        <Icon
                          name="check_circle"
                          size={16}
                          className="text-secondary shrink-0"
                        />
                      )}
                    </div>
                    <p
                      className={`text-sm mt-0.5 ${
                        isSelected
                          ? "text-on-secondary-container/80"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {role.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
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
