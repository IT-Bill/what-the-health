"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
  {
    id: "apple",
    icon: "favorite",
    name: "Apple Health",
    description: "同步步数、心率、睡眠数据",
  },
  {
    id: "huawei",
    icon: "watch",
    name: "华为运动健康",
    description: "同步运动、睡眠、心率数据",
  },
  {
    id: "samsung",
    icon: "phone_android",
    name: "Samsung Health",
    description: "同步步数、心率、睡眠数据",
  },
  {
    id: "xiaomi",
    icon: "fitness_center",
    name: "小米健康 / Zepp Life",
    description: "同步运动、睡眠数据",
  },
  {
    id: "google",
    icon: "cloud",
    name: "Google Fit",
    description: "同步活动、心率数据",
  },
];

export default function HealthConnectionsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health/import")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setImports(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleUpload(file: File, pw?: string) {
    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (pw) formData.append("password", pw);

    try {
      const res = await fetch("/api/health/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setUploadResult({
          success: true,
          message: `导入成功！共 ${data.recordCount.toLocaleString()} 条记录`,
        });
        setNeedsPassword(false);
        setPendingFile(null);
        setPassword("");
        // Refresh import history
        const historyRes = await fetch("/api/health/import");
        if (historyRes.ok) setImports(await historyRes.json());
      } else if (data.code === "PASSWORD_REQUIRED" || data.code === "PASSWORD_INCORRECT") {
        setNeedsPassword(true);
        setPendingFile(file);
        setUploadResult({
          success: false,
          message: data.code === "PASSWORD_INCORRECT" ? "密码错误，请重新输入" : "该文件需要密码",
        });
      } else {
        setUploadResult({ success: false, message: data.error || "导入失败" });
      }
    } catch {
      setUploadResult({ success: false, message: "网络错误，请稍后重试" });
    } finally {
      setUploading(false);
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
                  <span className="material-symbols-outlined">{device.icon}</span>
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
                    <span className={`material-symbols-outlined text-lg ${imp.status === "completed" ? "text-secondary" : imp.status === "failed" ? "text-error" : "text-on-surface-variant"}`}>
                      {imp.status === "completed" ? "check_circle" : imp.status === "failed" ? "error" : "hourglass_top"}
                    </span>
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
                        <> · {new Date(imp.dataFrom).toLocaleDateString("zh-CN")} - {new Date(imp.dataTo).toLocaleDateString("zh-CN")}</>
                      )}
                    </p>
                  </div>
                  {imp.status === "completed" && (
                    <button
                      onClick={() => handleDeleteImport(imp.id)}
                      className="text-on-surface-variant hover:text-error transition-colors p-1"
                      title="删除"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={() => !uploading && setShowUpload(false)}>
          <div className="bg-surface w-[90%] max-w-md rounded-2xl p-6 flex flex-col gap-5 animate-[fadeIn_0.2s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-on-surface">导入健康数据</h2>
              <button onClick={() => !uploading && setShowUpload(false)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="text-sm text-on-surface-variant space-y-2">
              <p>请上传从健康应用导出的 ZIP 文件：</p>
              <ul className="list-disc list-inside text-xs space-y-1 text-outline">
                <li>Apple Health：健康 → 头像 → 导出所有健康数据</li>
                <li>华为：设置 → 隐私中心 → 请求个人数据</li>
                <li>Samsung：设置 → 下载个人数据</li>
                <li>小米/Zepp：设置 → 账号 → 导出数据</li>
              </ul>
            </div>

            {/* Drop zone */}
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
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                    <p className="text-sm text-on-surface-variant">点击选择 ZIP 文件</p>
                    <p className="text-xs text-outline">最大 500MB</p>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Password input (when ZIP is encrypted) */}
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

            {/* Result */}
            {uploadResult && (
              <div className={`rounded-xl p-4 text-sm ${uploadResult.success ? "bg-secondary-container/50 text-on-secondary-container" : "bg-error-container/50 text-on-error-container"}`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    {uploadResult.success ? "check_circle" : "error"}
                  </span>
                  {uploadResult.message}
                </div>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="flex items-start gap-2 pt-2 border-t border-outline-variant/10">
              <span className="material-symbols-outlined text-sm text-outline mt-0.5">shield</span>
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
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 h-16">
      <Link
        href="/profile"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full -ml-2"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <h1 className="[font-family:var(--font-display)] text-xl font-medium text-on-surface ml-2">
        {title}
      </h1>
    </header>
  );
}
