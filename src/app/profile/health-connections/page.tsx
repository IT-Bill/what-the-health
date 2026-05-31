"use client";

import { useState, useEffect, useRef } from "react";
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

interface PreviewData {
  previewId: string;
  source: string;
  totalRecords: number;
  dataFrom: string;
  dataTo: string;
  summary: Record<string, number>;
  monthlyBreakdown: Record<string, Record<string, number>>;
}

const devices: HealthDevice[] = [
  { id: "apple", icon: "favorite", name: "Apple Health", description: "同步步数、心率、睡眠数据" },
  { id: "huawei", icon: "watch", name: "华为运动健康", description: "同步运动、睡眠、心率数据" },
  { id: "samsung", icon: "phone_android", name: "Samsung Health", description: "同步步数、心率、睡眠数据" },
  { id: "xiaomi", icon: "fitness_center", name: "小米健康 / Zepp Life", description: "同步运动、睡眠数据" },
  { id: "google", icon: "cloud", name: "Google Fit", description: "同步活动、心率数据" },
];

const SOURCE_LABELS: Record<string, string> = {
  appleHealth: "Apple Health",
  huaweiHealth: "华为运动健康",
  xiaomiHealth: "小米健康",
  samsungHealth: "Samsung Health",
  googleFit: "Google Fit",
};

const METRIC_LABELS: Record<string, string> = {
  steps: "步数",
  heartRate: "心率",
  restingHR: "静息心率",
  sleepAnalysis: "睡眠",
  workout: "运动",
  weight: "体重",
  bloodPressure: "血压",
  bloodOxygen: "血氧",
  calories: "卡路里",
  distance: "距离",
  hrv: "HRV",
  stress: "压力",
  mindfulSession: "正念",
  flightsClimbed: "爬楼",
  respiratoryRate: "呼吸频率",
};

export default function HealthConnectionsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health/import")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setImports(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Calculate filtered record count based on date selection
  const filteredCount = preview
    ? Object.entries(preview.monthlyBreakdown).reduce((total, [month, metrics]) => {
        const monthDate = new Date(month + "-01");
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        // Include month if it overlaps with the selected range
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        if (from && monthEnd < from) return total;
        if (to && monthDate > to) return total;
        return total + Object.values(metrics).reduce((s, n) => s + n, 0);
      }, 0)
    : 0;

  async function handleUpload(file: File, pw?: string) {
    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (pw) formData.append("password", pw);

    try {
      const res = await fetch("/api/health/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setPreview(data);
        setDateFrom(data.dataFrom.slice(0, 10));
        setDateTo(data.dataTo.slice(0, 10));
        setNeedsPassword(false);
        setPendingFile(null);
        setPassword("");
      } else if (data.code === "PASSWORD_REQUIRED" || data.code === "PASSWORD_INCORRECT") {
        setNeedsPassword(true);
        setPendingFile(file);
        setUploadResult({
          success: false,
          message: data.code === "PASSWORD_INCORRECT" ? "密码错误，请重新输入" : "该文件需要密码",
        });
      } else {
        setUploadResult({ success: false, message: data.error || "解析失败" });
      }
    } catch {
      setUploadResult({ success: false, message: "网络错误，请稍后重试" });
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setConfirming(true);
    setUploadResult(null);

    try {
      const res = await fetch("/api/health/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: preview.previewId,
          dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
          dateTo: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : null,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setUploadResult({
          success: true,
          message: `导入成功！共 ${data.recordCount.toLocaleString()} 条记录`,
        });
        setPreview(null);
        // Refresh import history
        const historyRes = await fetch("/api/health/import");
        if (historyRes.ok) setImports(await historyRes.json());
      } else {
        setUploadResult({ success: false, message: data.error || "导入失败" });
      }
    } catch {
      setUploadResult({ success: false, message: "网络错误，请稍后重试" });
    } finally {
      setConfirming(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handlePasswordSubmit() {
    if (pendingFile && password) {
      handleUpload(pendingFile, password);
    }
  }

  function handleCloseDialog() {
    if (uploading || confirming) return;
    setShowUpload(false);
    setPreview(null);
    setUploadResult(null);
    setNeedsPassword(false);
    setPassword("");
    setPendingFile(null);
  }

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
                  onClick={() => setShowUpload(true)}
                  className="text-xs font-medium text-on-surface-variant border border-outline-variant/40 rounded-full px-3 py-1.5 hover:bg-surface-variant/20 transition-colors"
                >
                  导入
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

      {/* Upload Dialog */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-sm"
          onClick={handleCloseDialog}
        >
          <div
            className="bg-surface w-[90%] max-w-md rounded-2xl p-6 flex flex-col gap-5 animate-[fadeIn_0.2s_ease] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-on-surface">
                {preview ? "数据预览" : "导入健康数据"}
              </h2>
              <button onClick={handleCloseDialog} className="text-on-surface-variant">
                <Icon name="close" />
              </button>
            </div>

            {/* Step 1: Upload */}
            {!preview && (
              <>
                <div className="text-sm text-on-surface-variant space-y-2">
                  <p>请上传从健康应用导出的 ZIP 文件：</p>
                  <ul className="list-disc list-inside text-xs space-y-1 text-outline">
                    <li>Apple Health：健康 → 头像 → 导出所有健康数据</li>
                    <li>华为：设置 → 隐私中心 → 请求个人数据</li>
                    <li>Samsung：设置 → 下载个人数据</li>
                    <li>小米/Zepp：设置 → 账号 → 导出数据</li>
                  </ul>
                </div>

                {!needsPassword && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="border-2 border-dashed border-outline-variant/50 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-secondary/50 hover:bg-surface-variant/10 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-on-surface-variant">正在解析...</p>
                      </>
                    ) : (
                      <>
                        <Icon name="upload_file" />
                        <p className="text-sm text-on-surface-variant">点击选择 ZIP 文件</p>
                        <p className="text-xs text-outline">最大 500MB</p>
                      </>
                    )}
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />

                {needsPassword && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-on-surface-variant">该文件需要密码才能解压：</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                        placeholder="输入 ZIP 密码"
                        className="flex-1 bg-surface-container-low border-0 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary"
                      />
                      <button
                        onClick={handlePasswordSubmit}
                        disabled={uploading || !password}
                        className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-40"
                      >
                        {uploading ? "解析中..." : "确认"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 2: Preview */}
            {preview && (
              <>
                {/* Source & Total */}
                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">数据来源</span>
                    <span className="text-sm font-medium text-on-surface">
                      {SOURCE_LABELS[preview.source] || preview.source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">总记录数</span>
                    <span className="text-sm font-medium text-on-surface">
                      {preview.totalRecords.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">数据范围</span>
                    <span className="text-sm font-medium text-on-surface">
                      {new Date(preview.dataFrom).toLocaleDateString("zh-CN")} —{" "}
                      {new Date(preview.dataTo).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>

                {/* Metric Summary */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.summary)
                    .sort(([, a], [, b]) => b - a)
                    .map(([metric, count]) => (
                      <span
                        key={metric}
                        className="inline-flex items-center gap-1 bg-secondary-container/40 text-on-secondary-container rounded-full px-3 py-1 text-xs"
                      >
                        {METRIC_LABELS[metric] || metric}
                        <span className="font-medium">{count.toLocaleString()}</span>
                      </span>
                    ))}
                </div>

                {/* Time Range Selection */}
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-on-surface">选择导入时间范围</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-on-surface-variant">开始日期</label>
                      <input
                        type="date"
                        value={dateFrom}
                        min={preview.dataFrom.slice(0, 10)}
                        max={dateTo || preview.dataTo.slice(0, 10)}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-on-surface border-0 focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-on-surface-variant">结束日期</label>
                      <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || preview.dataFrom.slice(0, 10)}
                        max={preview.dataTo.slice(0, 10)}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-on-surface border-0 focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    预计导入约 <span className="font-medium text-secondary">{filteredCount.toLocaleString()}</span> 条记录
                  </p>
                </div>

                {/* Quick select buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "最近1个月", months: 1 },
                    { label: "最近3个月", months: 3 },
                    { label: "最近半年", months: 6 },
                    { label: "最近1年", months: 12 },
                    { label: "全部", months: 0 },
                  ].map(({ label, months }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (months === 0) {
                          setDateFrom(preview.dataFrom.slice(0, 10));
                          setDateTo(preview.dataTo.slice(0, 10));
                        } else {
                          const to = new Date(preview.dataTo);
                          const from = new Date(to);
                          from.setMonth(from.getMonth() - months);
                          const minDate = new Date(preview.dataFrom);
                          setDateFrom(from < minDate ? preview.dataFrom.slice(0, 10) : from.toISOString().slice(0, 10));
                          setDateTo(to.toISOString().slice(0, 10));
                        }
                      }}
                      className="text-xs border border-outline-variant/40 rounded-full px-3 py-1.5 hover:bg-surface-variant/20 text-on-surface-variant transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmImport}
                  disabled={confirming || filteredCount === 0}
                  className="w-full py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>确认导入 ({filteredCount.toLocaleString()} 条)</>
                  )}
                </button>
              </>
            )}

            {/* Result */}
            {uploadResult && (
              <div
                className={`rounded-xl p-4 text-sm ${
                  uploadResult.success
                    ? "bg-secondary-container/50 text-on-secondary-container"
                    : "bg-error-container/50 text-on-error-container"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {uploadResult.success ? "check_circle" : "error"}
                  </span>
                  {uploadResult.message}
                </div>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="flex items-start gap-2 pt-2 border-t border-outline-variant/10">
              <Icon name="shield" />
              <p className="text-[11px] text-outline leading-relaxed">
                我们将你的隐私放在首位。所有健康数据仅在你的设备和我们的服务器之间传输，解析完成后原始文件立即删除，不会存储或发送给任何第三方。你可以随时在导入记录中删除已导入的数据。
              </p>
            </div>
          </div>
        </div>
      )}
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
        <Icon name="notifications" />
      </Link>
    </header>
  );
}
