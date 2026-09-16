"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface HealthDevice {
  id: string;
  icon: string;
  name: string;
  description: string;
}

interface ImportRecord {
  id: string;
  source: string;
  fileName: string;
  fileSize: number;
  status: string;
  recordCount: number;
  dataFrom: string | null;
  dataTo: string | null;
  summary: Record<string, number> | null;
  error: string | null;
  createdAt: string;
}

const devices: HealthDevice[] = [
  { id: "apple", icon: "favorite", name: "Apple Health", description: "同步步数、心率、睡眠数据" },
  { id: "huawei", icon: "watch", name: "华为运动健康", description: "同步运动、睡眠、心率数据" },
  { id: "samsung", icon: "phone_android", name: "Samsung Health", description: "同步步数、心率、睡眠数据" },
  { id: "xiaomi", icon: "fitness_center", name: "小米健康 / Zepp Life", description: "同步运动、睡眠数据" },
  { id: "google", icon: "cloud", name: "Google Fit", description: "同步活动、心率数据" },
];

export default function HealthConnectionsPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);

  useEffect(() => {
    fetch("/api/health/import")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setImports(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleDeleteImport(id: string) {
    if (!confirm("确定删除这次导入的所有数据吗？")) return;
    const res = await fetch(`/api/health/import/${id}`, { method: "DELETE" });
    if (res.ok) {
      setImports((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="健康连接" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full flex flex-col gap-6">
        <p className="text-sm text-on-surface-variant">健康数据文件导入暂未开放，已导入的数据仍可查看。</p>
        {/* Devices */}
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          {devices.map((device, index) => (
            <div
              key={device.id}
              className={`flex items-center justify-between py-5 ${
                index < devices.length - 1 ? "border-b border-on-surface-variant/10" : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface flex-shrink-0">
                  <Icon name={device.icon} />
                </div>
                <div className="min-w-0">
                  <p className="text-base text-on-surface font-medium">{device.name}</p>
                  <p className="text-sm text-on-surface-variant">{device.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  disabled
                  className="text-xs font-medium text-on-surface-variant border border-outline-variant/40 rounded-full px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  暂未开放
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Import History */}
        {imports.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3 px-2">
              导入记录
            </h3>
            <div className="flex flex-col gap-3">
              {imports.map((imp) => (
                <div key={imp.id} className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center">
                    <Icon
                      name={imp.status === "completed" ? "check_circle" : imp.status === "failed" ? "error" : "hourglass_top"}
                      className={
                        imp.status === "completed"
                          ? "text-secondary"
                          : imp.status === "failed"
                          ? "text-error"
                          : "text-on-surface-variant"
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{imp.fileName}</p>
                    <p className="text-xs text-on-surface-variant">
                      {imp.status === "completed"
                        ? `${imp.recordCount.toLocaleString()} 条记录`
                        : imp.status === "failed"
                        ? imp.error || "导入失败"
                        : "处理中..."}
                      {imp.dataFrom && imp.dataTo && (
                        <>
                          {" · "}
                          {new Date(imp.dataFrom).toLocaleDateString("zh-CN")} -{" "}
                          {new Date(imp.dataTo).toLocaleDateString("zh-CN")}
                        </>
                      )}
                    </p>
                  </div>
                  {imp.status === "completed" && (
                    <button
                      onClick={() => handleDeleteImport(imp.id)}
                      className="text-on-surface-variant hover:text-error transition-colors p-1"
                      title="删除"
                    >
                      <Icon name="delete" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
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
        <Icon name="arrow_back" />
      </Link>
      <h1 className="[font-family:var(--font-display)] text-xl font-medium text-on-surface flex-1 text-center px-4">
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
