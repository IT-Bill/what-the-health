"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";

interface FamilyMember {
  id: string;
  role: string;
  nickname: string | null;
  alertLevel: string;
  shareHealthData: boolean;
  shareAlerts: boolean;
  shareMoodHistory: boolean;
  joinedAt: string;
  user: { id: string; username: string; name: string; avatarUrl: string | null };
}

interface FamilyAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  sourceUser: { id: string; name: string; avatarUrl: string | null };
}

interface FamilyDetail {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  members: FamilyMember[];
  alerts: FamilyAlert[];
  myRole: string;
}

interface HealthViewData {
  user: { id: string; name: string; avatarUrl: string | null };
  nickname: string | null;
  period: { days: number; since: string };
  summary: Record<string, { count: number; avg: number; min: number; max: number; latest: number; unit: string }>;
  moodHistory: { mood: string; note: string | null; createdAt: string }[];
  reports: { id: string; periodType: string; periodStart: string; summary?: string }[];
}

const ROLE_LABELS: Record<string, string> = { owner: "管理员", caregiver: "关怀者", member: "被关怀者", observer: "普通成员" };
const ROLE_OPTIONS = [
  { value: "caregiver", label: "关怀者", desc: "收到被关怀者的健康预警" },
  { value: "member", label: "被关怀者", desc: "出问题时通知关怀者" },
  { value: "observer", label: "普通成员", desc: "可查看数据，不参与预警" },
];
const SEVERITY_COLORS: Record<string, string> = { critical: "text-error", warning: "text-tertiary", info: "text-on-surface-variant" };
const SEVERITY_ICONS: Record<string, string> = { critical: "error", warning: "warning", info: "health_metrics" };
const METRIC_LABELS: Record<string, string> = {
  steps: "步数", heartRate: "心率", restingHR: "静息心率", sleepAnalysis: "睡眠",
  workout: "运动", weight: "体重", bloodPressure: "血压", bloodOxygen: "血氧",
  calories: "卡路里", distance: "距离", hrv: "HRV", stress: "压力",
};

export default function FamilyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const familyId = params.id as string;
  const viewUserId = searchParams.get("view");
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [healthData, setHealthData] = useState<HealthViewData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    fetchFamily();
  }, [familyId]);

  useEffect(() => {
    if (viewUserId && familyId) {
      setHealthLoading(true);
      fetch(`/api/family/${familyId}/health/${viewUserId}?days=7`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setHealthData(d))
        .catch(() => setHealthData(null))
        .finally(() => setHealthLoading(false));
    } else {
      setHealthData(null);
    }
  }, [viewUserId, familyId]);

  async function fetchFamily() {
    try {
      const res = await fetch(`/api/family/${familyId}`);
      if (res.ok) setFamily(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function handleResolveAlert(alertId: string) {
    const res = await fetch(`/api/family/${familyId}/alerts/${alertId}`, { method: "PATCH" });
    if (res.ok) fetchFamily();
  }

  function copyInviteCode() {
    if (!family) return;
    navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <p className="text-on-surface-variant">家庭不存在或无权访问</p>
        <Link href="/discover/family" className="text-secondary mt-4">返回</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 h-16">
        <Link href="/discover/family" className="text-on-surface hover:opacity-70 transition-opacity p-2 rounded-full -ml-2">
          <Icon name="arrow_back" size={24} />
        </Link>
        <h1 className="font-[var(--font-display)] text-xl font-medium text-on-surface ml-2">{family.name}</h1>
      </header>

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full flex flex-col gap-6 pb-24">
        {/* Health Data Modal (bottom sheet) */}
        {viewUserId && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={() => window.history.back()}>
            <div
              className="bg-surface w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-4 animate-[fadeIn_0.2s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-on-surface flex items-center gap-2">
                  <Icon name="health_metrics" size={18} className="text-secondary" />
                  {healthData?.nickname || healthData?.user?.name || "成员"}的健康概览
                </h3>
                <Link href={`/discover/family/${familyId}`} className="text-on-surface-variant p-1">
                  <Icon name="close" size={20} />
                </Link>
              </div>

              {healthLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : healthData && Object.keys(healthData.summary).length > 0 ? (
                <div className="flex flex-col gap-4">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(healthData.summary).map(([metric, data]) => (
                      <div key={metric} className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{METRIC_LABELS[metric] || metric}</p>
                        <p className="text-lg font-medium text-on-surface mt-1">{data.avg} <span className="text-xs text-on-surface-variant">{data.unit}</span></p>
                        <p className="text-[10px] text-outline">范围 {data.min}–{data.max}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mood History */}
                  {healthData.moodHistory.length > 0 && (
                    <div className="bg-surface-container-low rounded-xl p-3">
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-2">情绪记录</p>
                      <div className="flex gap-1 flex-wrap">
                        {healthData.moodHistory.slice(0, 7).map((m, i) => (
                          <span key={i} className="text-lg" title={m.note || undefined}>
                            {m.mood === "calm" ? "😊" : m.mood === "anxious" ? "😰" : "😴"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reports link */}
                  {healthData.reports && healthData.reports.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">最近报告</p>
                      {healthData.reports.map((report: { id: string; periodType: string; periodStart: string; summary?: string }) => (
                        <div key={report.id} className="bg-surface-container-low rounded-xl p-3">
                          <p className="text-sm font-medium text-on-surface">
                            {report.periodType === "weekly" ? "周报" : "月报"} · {new Date(report.periodStart).toLocaleDateString("zh-CN")}
                          </p>
                          {report.summary && <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{report.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant text-center py-8">暂无健康数据</p>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {family.alerts.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3">
              健康预警 ({family.alerts.length})
            </h3>
            <div className="flex flex-col gap-3">
              {family.alerts.map((alert) => (
                <div key={alert.id} className="bg-error-container/20 border border-error/20 rounded-2xl p-4 flex gap-3">
                  <Icon
                    name={SEVERITY_ICONS[alert.severity] || "error"}
                    size={20}
                    className={SEVERITY_COLORS[alert.severity] || "text-error"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-on-surface">{alert.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        alert.severity === "critical" ? "bg-error/10 text-error" : "bg-tertiary/10 text-tertiary"
                      }`}>
                        {alert.severity === "critical" ? "严重" : alert.severity === "warning" ? "警告" : "提示"}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{alert.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-outline">
                        {alert.sourceUser.name} · {formatTime(alert.createdAt)}
                      </span>
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="text-[10px] text-secondary font-medium hover:opacity-70"
                      >
                        标记已处理
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest">
              成员 ({family.members.length})
            </h3>
            <button
              onClick={() => setShowInvite(true)}
              className="text-xs text-secondary font-medium flex items-center gap-1"
            >
              <Icon name="add" size={14} />
              邀请
            </button>
          </div>
          <div className="bg-primary-container rounded-2xl ambient-shadow overflow-hidden">
            {family.members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center gap-4 p-4 ${idx < family.members.length - 1 ? "border-b border-on-surface-variant/10" : ""}`}
              >
                <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center">
                  {member.user.avatarUrl ? (
                    <img src={member.user.avatarUrl} alt={member.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="person" size={20} className="text-on-surface-variant" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">
                    {member.nickname || member.user.name}
                    {member.nickname && <span className="text-on-surface-variant font-normal"> ({member.user.name})</span>}
                  </p>
                  {/* Role selector (owner can change others' roles) */}
                  {family.myRole === "owner" && member.role !== "owner" ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <select
                        value={member.role}
                        onChange={async (e) => {
                          const res = await fetch(`/api/family/${familyId}/members/${member.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ role: e.target.value }),
                          });
                          if (res.ok) fetchFamily();
                        }}
                        className="text-[11px] bg-surface-container-low text-on-surface-variant rounded-full pl-2.5 pr-6 py-1 border-0 focus:ring-1 focus:ring-secondary appearance-none cursor-pointer"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {member.shareHealthData && <span className="text-[10px] text-outline">· 数据共享中</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      {ROLE_LABELS[member.role]}
                      {member.shareHealthData && " · 健康数据共享中"}
                    </p>
                  )}
                </div>
                {member.shareHealthData && member.role !== "owner" && (
                  <Link
                    href={`/discover/family/${familyId}?view=${member.user.id}`}
                    className="text-xs text-secondary font-medium"
                  >
                    查看
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Family Purpose */}
        <section className="bg-surface-container-low rounded-2xl p-5">
          <h3 className="text-sm font-medium text-on-surface mb-3 flex items-center gap-2">
            <Icon name="shield" size={16} className="text-secondary" />
            关于家庭功能
          </h3>
          <ul className="text-xs text-on-surface-variant space-y-2 leading-relaxed">
            <li>• <strong>健康数据共享</strong>：被关怀者（如老人）的穿戴设备数据自动同步给关怀者（如子女），无需手动操作</li>
            <li>• <strong>异常自动预警</strong>：当检测到心率过高/过低、血压异常、血氧偏低等情况时，系统自动通知关怀者</li>
            <li>• <strong>对话关怀检测</strong>：老人通过语音与AI对话时，如果表达了身体不适，系统会综合判断后通知家人</li>
            <li>• <strong>隐私保护</strong>：每位成员可自主控制共享内容，随时可退出家庭</li>
          </ul>
        </section>

        {/* Danger Zone (owner only) */}
        {family.myRole === "owner" && (
          <section className="border border-error/20 rounded-2xl p-5">
            <p className="text-xs text-on-surface-variant mb-3">解散家庭将移除所有成员和预警记录，此操作不可撤销。</p>
            <button
              onClick={async () => {
                if (!confirm("确定要解散家庭吗？所有成员将被移除。")) return;
                const res = await fetch(`/api/family/${familyId}`, { method: "DELETE" });
                if (res.ok) window.location.href = "/discover/family";
              }}
              className="text-xs text-error font-medium"
            >
              解散家庭
            </button>
          </section>
        )}
      </main>

      {/* Invite Dialog */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="bg-surface w-[90%] max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-on-surface mb-2">邀请家人加入</h2>
            <p className="text-xs text-on-surface-variant mb-4">将以下邀请码发送给家人，对方在「加入家庭」中输入即可</p>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 flex items-center justify-between mb-4">
              <code className="text-sm font-mono text-on-surface">{family.inviteCode}</code>
              <button onClick={copyInviteCode} className="text-secondary text-xs font-medium">
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <p className="text-[11px] text-outline">邀请码长期有效，任何人使用该码均可加入此家庭</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}
