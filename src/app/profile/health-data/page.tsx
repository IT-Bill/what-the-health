"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HealthStat {
  metric: string;
  _count: number;
  _avg: { value: number | null };
  _min: { startDate: string | null; value: number | null };
  _max: { startDate: string | null; value: number | null };
}

interface HealthRecord {
  id: string;
  metric: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  metadata: Record<string, unknown> | null;
  sourceName: string | null;
  source: string;
}

const METRIC_LABELS: Record<string, { label: string; icon: string }> = {
  steps: { label: "步数", icon: "directions_walk" },
  heartRate: { label: "心率", icon: "favorite" },
  restingHR: { label: "静息心率", icon: "monitor_heart" },
  sleepAnalysis: { label: "睡眠", icon: "bedtime" },
  workout: { label: "运动", icon: "fitness_center" },
  weight: { label: "体重", icon: "scale" },
  bloodPressure: { label: "血压", icon: "bloodtype" },
  bloodOxygen: { label: "血氧", icon: "spo2" },
  calories: { label: "卡路里", icon: "local_fire_department" },
  distance: { label: "距离", icon: "straighten" },
  hrv: { label: "HRV", icon: "timeline" },
  stress: { label: "压力", icon: "psychology" },
  mindfulSession: { label: "正念", icon: "self_improvement" },
  flightsClimbed: { label: "爬楼", icon: "stairs" },
  respiratoryRate: { label: "呼吸率", icon: "air" },
};

export default function HealthDataPage() {
  const [stats, setStats] = useState<HealthStat[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health/records?limit=100")
      .then((r) => (r.ok ? r.json() : { records: [], stats: [] }))
      .then((data) => {
        setStats(data.stats || []);
        setRecords(data.records || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function fetchMetric(metric: string) {
    setSelectedMetric(metric);
    setLoading(true);
    fetch(`/api/health/records?metric=${metric}&limit=500`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((data) => setRecords(data.records || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="健康数据" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full flex flex-col gap-6">
        {/* Stats overview */}
        {stats.length > 0 ? (
          <section>
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3 px-1">
              数据概览
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => {
                const info = METRIC_LABELS[stat.metric] || { label: stat.metric, icon: "data_usage" };
                const isActive = selectedMetric === stat.metric;
                return (
                  <button
                    key={stat.metric}
                    onClick={() => fetchMetric(stat.metric)}
                    className={`bg-primary-container rounded-2xl p-4 ambient-shadow flex flex-col gap-1 text-left transition-all duration-300 ${
                      isActive ? "ring-2 ring-secondary" : "hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-lg">{info.icon}</span>
                      <span className="text-xs font-medium text-on-surface-variant">{info.label}</span>
                    </div>
                    <p className="text-xl font-semibold text-on-surface">
                      {stat._count.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">条记录</p>
                    {stat._avg.value !== null && (
                      <p className="text-xs text-secondary">
                        均值: {stat._avg.value.toFixed(1)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : !loading ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-4 block">health_metrics</span>
            <p className="text-lg">还没有健康数据</p>
            <p className="text-sm mt-1">
              去{" "}
              <Link href="/profile/health-connections" className="text-secondary underline">
                健康连接
              </Link>{" "}
              导入你的数据
            </p>
          </div>
        ) : null}

        {/* Trend chart (simple bar visualization) */}
        {selectedMetric && records.length > 0 && (
          <section className="bg-primary-container rounded-2xl p-5 ambient-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-on-surface">
                {METRIC_LABELS[selectedMetric]?.label || selectedMetric} 趋势
              </h3>
              <span className="text-xs text-on-surface-variant">
                最近 {Math.min(records.length, 30)} 条
              </span>
            </div>
            <div className="flex items-end gap-px h-24">
              {records.slice(0, 30).reverse().map((r, i) => {
                const max = Math.max(...records.slice(0, 30).map((x) => x.value));
                const min = Math.min(...records.slice(0, 30).map((x) => x.value));
                const range = max - min || 1;
                const height = ((r.value - min) / range) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-secondary/50 rounded-t-sm hover:bg-secondary/80 transition-colors"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${r.value} ${r.unit} | ${new Date(r.startDate).toLocaleDateString("zh-CN")}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant">
              <span>{records.length > 0 ? new Date(records[records.length > 30 ? 29 : records.length - 1].startDate).toLocaleDateString("zh-CN") : ""}</span>
              <span>{records.length > 0 ? new Date(records[0].startDate).toLocaleDateString("zh-CN") : ""}</span>
            </div>
          </section>
        )}

        {/* Recent records list */}
        {records.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3 px-1">
              {selectedMetric ? `${METRIC_LABELS[selectedMetric]?.label || selectedMetric} 记录` : "最近记录"}
            </h3>
            <div className="flex flex-col gap-2">
              {records.slice(0, 20).map((r) => {
                const info = METRIC_LABELS[r.metric] || { label: r.metric, icon: "data_usage" };
                return (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-b-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface">
                        {r.value.toLocaleString()} {r.unit}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {new Date(r.startDate).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {r.sourceName && ` · ${r.sourceName}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
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
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <h1 className="[font-family:var(--font-display)] text-xl font-medium text-on-surface flex-1 text-center px-4">
        {title}
      </h1>
      <Link
        href="/notifications"
        aria-label="通知中心"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center w-10 h-10 rounded-full"
      >
        <span className="material-symbols-outlined">notifications</span>
      </Link>
    </header>
  );
}
