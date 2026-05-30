"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import type {
  ReportData,
  ReportWithInsights,
  InsightRecord,
  MemoryApiResponse,
} from "@/lib/memory-types";

const TABS = ["周报", "月报", "洞察"] as const;
type Tab = (typeof TABS)[number];

const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// --- Demo types ---
interface DemoUser {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

interface DemoEntry {
  user: DemoUser;
  report: {
    id: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    summary: string | null;
    data: ReportData;
  } | null;
  insights: InsightRecord[];
}

interface DemoApiResponse {
  demos: DemoEntry[];
  demo: true;
}

// --- Main Component ---

export default function MemoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("周报");
  const [data, setData] = useState<MemoryApiResponse | null>(null);
  const [demoData, setDemoData] = useState<DemoApiResponse | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPeriodIdx, setCurrentPeriodIdx] = useState(0);

  const periodType = activeTab === "月报" ? "monthly" : "weekly";

  const fetchReport = useCallback(
    async (periodStart?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: periodType });
        if (periodStart) params.set("periodStart", periodStart);
        const res = await fetch(`/api/memory?${params}`);
        const json = await res.json();

        if (json.demo) {
          // Unauthenticated — demo mode
          setIsDemo(true);
          setDemoData(json as DemoApiResponse);
          setData(null);
        } else {
          // Authenticated — user's own data
          setIsDemo(false);
          setDemoData(null);
          setData(json as MemoryApiResponse);
          if (json.report && json.available?.length > 0) {
            const idx = json.available.findIndex(
              (d: string) => d.slice(0, 10) === json.report!.periodStart.slice(0, 10)
            );
            setCurrentPeriodIdx(idx >= 0 ? idx : 0);
          }
        }
      } catch {
        setData(null);
        setDemoData(null);
      } finally {
        setLoading(false);
      }
    },
    [periodType]
  );

  useEffect(() => {
    setCurrentPeriodIdx(0);
    fetchReport();
  }, [fetchReport]);

  function goPrev() {
    if (!data || currentPeriodIdx >= data.available.length - 1) return;
    const prevPeriod = data.available[currentPeriodIdx + 1];
    fetchReport(prevPeriod.slice(0, 10));
  }

  function goNext() {
    if (!data || currentPeriodIdx <= 0) return;
    const nextPeriod = data.available[currentPeriodIdx - 1];
    fetchReport(nextPeriod.slice(0, 10));
  }

  const hasPrev = data ? currentPeriodIdx < data.available.length - 1 : false;
  const hasNext = data ? currentPeriodIdx > 0 : false;

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap ${
                activeTab === tab
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Period Navigator (for 周报/月报, authenticated only) */}
        {!isDemo && activeTab !== "洞察" && data?.report && (
          <PeriodNav
            report={data.report}
            periodType={periodType}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : isDemo ? (
          <DemoView demos={demoData?.demos ?? []} periodType={periodType} activeTab={activeTab} />
        ) : !data?.report && activeTab !== "洞察" ? (
          <EmptyState />
        ) : activeTab === "洞察" ? (
          <InsightsView
            reportInsights={data?.report?.insights ?? []}
            globalInsights={data?.globalInsights ?? []}
          />
        ) : (
          <ReportView report={data!.report!} periodType={periodType} />
        )}
      </div>
    </AppShell>
  );
}

// --- Period Navigator ---
function PeriodNav({
  report,
  periodType,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  report: ReportWithInsights;
  periodType: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const start = new Date(report.periodStart);
  const label =
    periodType === "monthly"
      ? `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月`
      : formatWeekLabel(start);

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <span className="text-base font-medium text-on-surface">{label}</span>
      <button
        onClick={onNext}
        disabled={!hasNext}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}

function formatWeekLabel(start: Date): string {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${fmt(start)} — ${fmt(end)}`;
}

// --- Report View (renders whichever sections have data) ---
function ReportView({
  report,
  periodType,
}: {
  report: ReportWithInsights;
  periodType: string;
}) {
  const d = report.data;
  const isMonthly = periodType === "monthly";

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease]">
      {/* Overall Score */}
      {d.overallScore !== undefined && (
        <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 border border-outline-variant/20 ambient-shadow text-center">
          <p className="text-sm text-on-surface-variant uppercase tracking-widest mb-2">综合评分</p>
          <p className="font-[var(--font-display)] text-5xl font-semibold text-on-surface mb-3">
            {d.overallScore}
            <span className="text-2xl text-on-surface-variant font-normal">/100</span>
          </p>
          <div className="w-full max-w-xs mx-auto h-3 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full bg-secondary rounded-full transition-all duration-1000"
              style={{ width: `${d.overallScore}%` }}
            />
          </div>
        </section>
      )}

      {/* Summary */}
      {report.summary && (
        <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-tertiary-container/40 rounded-full blur-2xl" />
          <p className="text-base text-on-surface leading-relaxed relative z-10 italic">
            &ldquo;{report.summary}&rdquo;
          </p>
        </section>
      )}

      {/* Mood Emojis */}
      {d.moodEmojis && d.moodEmojis.length > 0 && (
        <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-4">
            {isMonthly ? "情绪日历" : "本周情绪"}
          </h3>
          {isMonthly ? (
            <div className="grid grid-cols-7 gap-2">
              {d.moodEmojis.map((mood, i) => (
                <div
                  key={i}
                  className="aspect-square flex items-center justify-center rounded-lg bg-surface/60 text-lg"
                >
                  {mood}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              {d.moodEmojis.map((mood, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="text-2xl">{mood}</span>
                  <span className="text-xs text-on-surface-variant">
                    {WEEK_DAYS[i] ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Stats Grid */}
      {d.stats && d.stats.length > 0 && (
        <section className="grid grid-cols-2 gap-4">
          {d.stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-primary-container rounded-2xl p-5 ambient-shadow flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">{stat.icon}</span>
                <span className="text-xs font-medium uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-on-surface">{stat.value}</span>
                {stat.change && (
                  <span
                    className={`text-sm font-medium ${
                      stat.positive ? "text-secondary" : "text-error"
                    }`}
                  >
                    {stat.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Sleep Chart */}
      {d.sleepData && d.sleepData.length > 0 && (
        <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-6">
            {isMonthly ? "30天睡眠趋势" : "本周睡眠"}
          </h3>
          {isMonthly ? (
            <>
              <div className="flex items-end gap-px h-20">
                {d.sleepData.map((hours, i) => {
                  const height = ((hours - 5) / 3) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-secondary/50 rounded-t-sm hover:bg-secondary/80 transition-colors"
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`Day ${i + 1}: ${hours}h`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-on-surface-variant">1日</span>
                <span className="text-xs text-on-surface-variant">15日</span>
                <span className="text-xs text-on-surface-variant">30日</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-1 h-24">
                {d.sleepData.map((hours, i) => {
                  const height = ((hours - 4) / 4) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                      <span className="text-xs text-on-surface-variant mb-1">{hours}h</span>
                      <div
                        className="w-full max-w-[32px] bg-secondary/60 rounded-t-lg"
                        style={{ height: `${Math.max(height, 10)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 px-1">
                {WEEK_DAYS.map((d) => (
                  <span key={d} className="text-xs text-on-surface-variant flex-1 text-center">
                    {d}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Highlights */}
      {d.highlights && d.highlights.length > 0 && (
        <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 border border-outline-variant/20 ambient-shadow">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-5">
            {isMonthly ? "本月亮点" : "本周亮点"}
          </h3>
          <div className="flex flex-col gap-4">
            {d.highlights.map((h) => (
              <div
                key={h.label}
                className="flex items-center gap-4 py-2 border-b border-on-surface-variant/5 last:border-b-0"
              >
                <span className="material-symbols-outlined text-secondary text-xl">
                  {h.icon}
                </span>
                <span className="text-base text-on-surface-variant flex-1">{h.label}</span>
                <span className="text-base font-medium text-on-surface">{h.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      {d.achievements && d.achievements.length > 0 && (
        <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-5">
            🏆 成就
          </h3>
          <div className="flex flex-col gap-3">
            {d.achievements.map((a) => (
              <div key={a.title} className="flex items-center gap-4 py-2">
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <p className="text-base text-on-surface font-medium">{a.title}</p>
                  <p className="text-xs text-on-surface-variant">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Report-linked insights */}
      {report.insights.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest px-1">
            🤖 AI 洞察
          </h3>
          {report.insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </section>
      )}

      {/* Shareable Card (monthly only) */}
      {isMonthly && d.overallScore && (
        <ShareableCard report={report} />
      )}
    </div>
  );
}

// --- Insights View ---
function InsightsView({
  reportInsights,
  globalInsights,
}: {
  reportInsights: InsightRecord[];
  globalInsights: InsightRecord[];
}) {
  const all = [...reportInsights, ...globalInsights];
  const correlations = all.filter((i) => i.type === "correlation");
  const others = all.filter((i) => i.type !== "correlation");

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease]">
      {/* AI understanding level */}
      <section className="bg-surface-container-low rounded-3xl p-6 md:p-8 border border-outline-variant/20 ambient-shadow text-center">
        <p className="text-sm text-on-surface-variant uppercase tracking-widest mb-2">
          AI 对你的了解度
        </p>
        <p className="font-[var(--font-display)] text-4xl font-semibold text-on-surface mb-3">
          Level 3
        </p>
        <div className="w-full max-w-xs mx-auto h-3 bg-surface-variant rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-1000"
            style={{ width: "78%" }}
          />
        </div>
        <p className="text-sm text-on-surface-variant mt-2">
          78% — 再聊几次就能解锁更深度的洞察
        </p>
      </section>

      {/* Insight Cards */}
      {others.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}

      {/* Correlations */}
      {correlations.length > 0 && (
        <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow">
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-5">
            身体关联地图
          </h3>
          <div className="flex flex-col gap-3">
            {correlations.map((c) => {
              const meta = c.metadata as { strength?: number } | null;
              const strength = meta?.strength ?? 50;
              return (
                <div key={c.id} className="flex flex-col gap-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface">{c.title}</span>
                    <span className="text-xs text-on-surface-variant">{strength}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary/70 rounded-full transition-all duration-700"
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant">{c.content}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Insight Card ---
function InsightCard({ insight }: { insight: InsightRecord }) {
  const typeConfig: Record<string, { emoji: string; tag: string }> = {
    pattern: { emoji: "🆕", tag: "行为模式" },
    prediction: { emoji: "⚠️", tag: "预测" },
    correlation: { emoji: "💡", tag: "关联分析" },
    milestone: { emoji: "🏆", tag: "里程碑" },
  };
  const config = typeConfig[insight.type] ?? { emoji: "💡", tag: insight.type };

  return (
    <section className="bg-primary-container rounded-3xl p-6 md:p-8 ambient-shadow relative overflow-hidden group">
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-tertiary-container/30 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <span className="text-xl">{config.emoji}</span>
        <h3 className="text-base font-medium text-on-surface">{insight.title}</h3>
        <span className="ml-auto text-xs text-on-surface-variant bg-surface-variant/50 px-2.5 py-0.5 rounded-full">
          {config.tag}
        </span>
      </div>
      <p className="text-base text-on-surface-variant leading-relaxed relative z-10">
        {insight.content}
      </p>
    </section>
  );
}

// --- Shareable Card ---
function ShareableCard({ report }: { report: ReportWithInsights }) {
  const d = report.data;
  return (
    <section className="bg-gradient-to-br from-primary-container via-surface to-tertiary-container/30 rounded-3xl p-8 ambient-shadow border border-outline-variant/20 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative z-10 text-center">
        <p className="text-sm text-on-surface-variant uppercase tracking-widest mb-4">
          ✨ 我的月度身体报告
        </p>

        {d.moodEmojis && (
          <div className="flex flex-wrap justify-center gap-1 mb-6 max-w-[280px] mx-auto">
            {d.moodEmojis.map((m, i) => (
              <span key={i} className="text-base">
                {m}
              </span>
            ))}
          </div>
        )}

        {d.stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {d.stats.slice(0, 3).map((s) => (
              <div key={s.label}>
                <p className="text-lg font-semibold text-on-surface">{s.value}</p>
                <p className="text-xs text-on-surface-variant">
                  {s.label} {s.change}
                </p>
              </div>
            ))}
          </div>
        )}

        {d.overallScore && (
          <div className="mb-4">
            <p className="text-xs text-on-surface-variant mb-1">
              🤖 综合评分
            </p>
            <div className="w-48 h-2 mx-auto bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full"
                style={{ width: `${d.overallScore}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-1">{d.overallScore}/100</p>
          </div>
        )}

        <p className="text-xs text-outline mt-4">─── 由 Mindful 生成 ───</p>
      </div>
    </section>
  );
}

// --- Demo View (unauthenticated visitors) ---
function DemoView({ demos, periodType, activeTab }: { demos: DemoEntry[]; periodType: string; activeTab: Tab }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  if (demos.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl mb-4 block">auto_stories</span>
        <p>暂无示例数据</p>
      </div>
    );
  }

  const selected = selectedIdx !== null ? demos[selectedIdx] : null;

  function handleCardClick(idx: number, cardEl: HTMLButtonElement) {
    if (selectedIdx === idx) {
      // Deselect
      setSelectedIdx(null);
      setPaused(false);
      setShowReport(false);
      return;
    }

    // Pause and select
    setPaused(true);
    setSelectedIdx(idx);
    setShowReport(false);

    // Scroll to center the clicked card
    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const scrollLeft = container.scrollLeft + (cardRect.left - containerRect.left) - (containerRect.width / 2) + (cardRect.width / 2);
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }

    // Show report after centering animation
    setTimeout(() => setShowReport(true), 400);
  }

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease]">
      {/* CTA Banner */}
      <section className="bg-gradient-to-br from-secondary-container/50 to-tertiary-container/30 rounded-2xl p-6 text-center border border-outline-variant/20">
        <span className="material-symbols-outlined text-3xl text-secondary mb-2">auto_awesome</span>
        <p className="text-base font-medium text-on-surface mb-1">解锁你的专属健康记忆</p>
        <p className="text-sm text-on-surface-variant mb-4">登录后，AI 会为你生成个性化的周报、月报和洞察</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-sm font-medium hover:opacity-90 transition-opacity"
        >
          登录 / 注册
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </section>

      {/* Scrolling user cards carousel */}
      <div
        ref={containerRef}
        className="overflow-x-auto no-scrollbar scroll-smooth"
      >
        <div
          ref={trackRef}
          className={`flex gap-4 px-4 ${paused ? "" : "animate-[scrollCards_12s_linear_infinite]"}`}
          style={{ width: "max-content" }}
        >
          {/* Duplicate cards for seamless loop */}
          {[...demos, ...demos].map((entry, idx) => {
            const realIdx = idx % demos.length;
            const isSelected = selectedIdx === realIdx;
            const data = entry.report?.data;
            return (
              <button
                key={`${entry.user.id}-${idx}`}
                onClick={(e) => handleCardClick(realIdx, e.currentTarget)}
                className={`flex-shrink-0 w-64 bg-primary-container rounded-2xl p-4 ambient-shadow flex flex-col gap-2 text-left transition-all duration-500 ${
                  isSelected
                    ? "ring-2 ring-secondary scale-[1.02] shadow-[0_20px_40px_rgba(45,45,45,0.08)]"
                    : "hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(45,45,45,0.06)]"
                }`}
              >
                {/* User row */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center flex-shrink-0">
                    {entry.user.avatarUrl ? (
                      <img src={entry.user.avatarUrl} alt={entry.user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{entry.user.name}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {periodType === "monthly" ? "月报" : "周报"}
                    </p>
                  </div>
                  {data?.overallScore && (
                    <span className="text-lg font-semibold text-secondary">{data.overallScore}</span>
                  )}
                </div>
                {/* Mood preview */}
                {data?.moodEmojis && (
                  <div className="flex gap-0.5">
                    {data.moodEmojis.slice(0, 7).map((emoji, i) => (
                      <span key={i} className="text-sm">{emoji}</span>
                    ))}
                  </div>
                )}
                {/* One-line summary */}
                {entry.report?.summary && (
                  <p className="text-[11px] text-on-surface-variant line-clamp-1">{entry.report.summary}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded report below */}
      {selected && showReport ? (
        <div className="animate-[fadeIn_0.4s_ease]">
          {activeTab === "洞察" ? (
            <InsightsView
              reportInsights={selected.insights}
              globalInsights={[]}
            />
          ) : selected.report ? (
            <ReportView
              report={{
                ...selected.report,
                insights: selected.insights,
              } as ReportWithInsights}
              periodType={periodType}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      ) : !selected ? (
        <p className="text-xs text-on-surface-variant text-center">
          点击卡片查看完整报告
        </p>
      ) : null}
    </div>
  );
}

// --- Loading & Empty States ---
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="bg-primary-container rounded-3xl h-32" />
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-primary-container rounded-2xl h-24" />
        <div className="bg-primary-container rounded-2xl h-24" />
      </div>
      <div className="bg-primary-container rounded-3xl h-40" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">
        auto_stories
      </span>
      <p className="text-lg text-on-surface-variant">还没有这个时期的报告</p>
      <p className="text-sm text-outline mt-2">继续使用Mindful，AI会定期为你生成分析</p>
    </div>
  );
}
