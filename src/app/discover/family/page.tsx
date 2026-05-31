"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface FamilyMemberInfo {
  id: string;
  role: string;
  nickname: string | null;
  user: { id: string; username: string; name: string; avatarUrl: string | null };
}

interface FamilyInfo {
  id: string;
  name: string;
  inviteCode: string;
  members: FamilyMemberInfo[];
  myRole: string;
}

const ROLE_LABELS: Record<string, string> = { owner: "管理员", caregiver: "关怀者", member: "被关怀者" };

export default function FamilyPage() {
  const [families, setFamilies] = useState<FamilyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { fetchFamilies(); }, []);

  async function fetchFamilies() {
    try {
      const res = await fetch("/api/family");
      if (res.ok) setFamilies(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!createName.trim()) return;
    setError("");
    const res = await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: createName.trim() }) });
    if (res.ok) { setShowCreate(false); setCreateName(""); fetchFamilies(); }
    else { const d = await res.json(); setError(d.error || "创建失败"); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setError("");
    const res = await fetch("/api/family/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode: joinCode.trim() }) });
    if (res.ok) { setShowJoin(false); setJoinCode(""); fetchFamilies(); }
    else { const d = await res.json(); setError(d.error || "加入失败"); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Info */}
      <div className="bg-secondary-container/30 rounded-2xl p-4 flex gap-3">
        <Icon name="favorite" size={20} className="text-secondary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          创建家庭，邀请家人加入。健康数据实时共享，异常时自动通知关怀者，让远方的牵挂变成实时的守护。
        </p>
      </div>

      {/* Family list */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" /></div>
      ) : families.length > 0 ? (
        <div className="flex flex-col gap-3">
          {families.map((family) => (
            <Link key={family.id} href={`/discover/family/${family.id}`} className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-4 hover:opacity-90 transition-opacity">
              <div className="w-11 h-11 rounded-full bg-secondary-container flex items-center justify-center">
                <Icon name="group" size={22} className="text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{family.name}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{family.members.length} 位成员 · {ROLE_LABELS[family.myRole]}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-variant" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-10 text-center">
          <Icon name="group" size={40} className="text-outline-variant mb-3" />
          <p className="text-on-surface-variant">还没有加入任何家庭</p>
          <p className="text-xs text-outline mt-1">创建或加入一个家庭，开始守护家人健康</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => { setShowCreate(true); setError(""); }} className="flex-1 py-2.5 rounded-xl bg-secondary text-on-secondary font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2">
          <Icon name="add" size={16} /> 创建家庭
        </button>
        <button onClick={() => { setShowJoin(true); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-on-surface-variant font-medium text-sm hover:bg-surface-variant/20 flex items-center justify-center gap-2">
          <Icon name="key" size={16} /> 加入家庭
        </button>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-surface w-[90%] max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-on-surface mb-4">创建家庭</h2>
            <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="家庭名称" className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant border-0 focus:ring-1 focus:ring-secondary mb-4" autoFocus />
            {error && <p className="text-xs text-error mb-3">{error}</p>}
            <button onClick={handleCreate} disabled={!createName.trim()} className="w-full py-3 rounded-xl bg-secondary text-on-secondary font-medium text-sm disabled:opacity-40">创建</button>
          </div>
        </div>
      )}

      {/* Join Dialog */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={() => setShowJoin(false)}>
          <div className="bg-surface w-[90%] max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-on-surface mb-4">加入家庭</h2>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="邀请码" className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant border-0 focus:ring-1 focus:ring-secondary mb-4" autoFocus />
            {error && <p className="text-xs text-error mb-3">{error}</p>}
            <button onClick={handleJoin} disabled={!joinCode.trim()} className="w-full py-3 rounded-xl bg-secondary text-on-secondary font-medium text-sm disabled:opacity-40">加入</button>
          </div>
        </div>
      )}
    </div>
  );
}
