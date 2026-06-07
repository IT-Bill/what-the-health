"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      router.replace("/profile");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* Left Side: Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container overflow-hidden items-center justify-center">
        <img
          src="/api/assets/static/pages/hero.jpg"
          alt="Serene minimal interior"
          className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 lg:px-16 py-20 relative z-10">
        <div className="max-w-md w-full mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 text-center lg:text-left">
            <h2 className="font-[var(--font-display)] text-2xl font-medium text-primary tracking-widest uppercase mb-12">
              静心
            </h2>
            <h1 className="font-[var(--font-display)] text-3xl md:text-5xl font-semibold text-on-background leading-tight">
              开启您的心灵之旅
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed">
              创建账户，追踪您的健康状态，发现内心的平静。
            </p>
          </div>

          {/* Sign Up Form */}
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-on-surface-variant mb-2 ml-4 tracking-wide"
                >
                  账号
                </label>
                <div className="relative">
                  <Icon name="key" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none" size={20} />
                  <input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="请输入账号"
                    className="block w-full rounded-full border-0 py-4 pl-12 pr-6 bg-surface-container text-on-background text-base placeholder:text-outline-variant focus:ring-1 focus:ring-secondary focus:bg-surface transition-all duration-300"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-on-surface-variant mb-2 ml-4 tracking-wide"
                >
                  密码
                </label>
                <div className="relative">
                  <Icon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none" size={20} />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="请输入密码"
                    className="block w-full rounded-full border-0 py-4 pl-12 pr-6 bg-surface-container text-on-background text-base placeholder:text-outline-variant focus:ring-1 focus:ring-secondary focus:bg-surface transition-all duration-300"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-on-surface-variant mb-2 ml-4 tracking-wide"
                >
                  确认密码
                </label>
                <div className="relative">
                  <Icon name="lock_reset" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none" />
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="请再次输入密码"
                    className="block w-full rounded-full border-0 py-4 pl-12 pr-6 bg-surface-container text-on-background text-base placeholder:text-outline-variant focus:ring-1 focus:ring-secondary focus:bg-surface transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-center px-2">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-5 w-5 rounded border-outline-variant text-secondary focus:ring-secondary bg-surface-container cursor-pointer transition-colors"
              />
              <label
                htmlFor="terms"
                className="ml-3 block text-sm text-on-surface-variant cursor-pointer"
              >
                我同意
                <Link href="/terms" className="text-primary underline underline-offset-2 transition-colors hover:text-secondary">
                  服务条款
                </Link>
                和
                <Link href="/privacy" className="text-primary underline underline-offset-2 transition-colors hover:text-secondary">
                  隐私政策
                </Link>
              </label>
            </div>

            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-8 border border-transparent rounded-full shadow-sm text-sm font-medium tracking-wide text-on-primary bg-inverse-surface hover:bg-on-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all duration-500 ease-out transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </form>

          {/* Footer */}
          <div className="pt-8 text-center border-t border-surface-variant/50">
            <p className="text-base text-on-surface-variant">
              已有账户？
              <Link
                href="/login"
                className="text-sm font-medium text-primary hover:text-secondary underline decoration-1 underline-offset-4 transition-colors duration-300 ml-1"
              >
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
