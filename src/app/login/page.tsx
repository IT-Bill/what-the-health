"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      router.push("/profile");
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
        <Image
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCm97K8ZZvci6jBa0e8OmzlmnZNwGMD69Xa8Qd7v4ICA-DJnOZEzGUBKMaEuliXKSk_yVW7awtCRHtq-uAjHWdMzBJ_ER0biUEjl-OsIIhZ21v0zdKFcGglYCJtwJ_9FemAWWqfC5DsIRjnq8dXpm4fwg_k2d7BSOaKCORYdOjMQmwf7Wdksa4Ko8KFJ8bt7AGfwu4m3KPEsVdyMB79Lfx8ZPq2MAWltVITmBz8wElmVucXqWzb13APjlpnTtuC5ROrwtnx86M3tGA"
          alt="Serene minimal interior"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover opacity-90 mix-blend-multiply"
          priority
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
              欢迎回到您的宁静港湾
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed">
              请输入您的信息，继续您的心灵之旅。
            </p>
          </div>

          {/* Login Form */}
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
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                    mail
                  </span>
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
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                    lock
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="请输入密码"
                    className="block w-full rounded-full border-0 py-4 pl-12 pr-6 bg-surface-container text-on-background text-base placeholder:text-outline-variant focus:ring-1 focus:ring-secondary focus:bg-surface transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-5 w-5 rounded border-outline-variant text-secondary focus:ring-secondary bg-surface-container cursor-pointer transition-colors"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-3 block text-base text-on-surface-variant cursor-pointer"
                >
                  记住我
                </label>
              </div>
              <a
                href="#"
                className="text-sm font-medium text-primary hover:text-secondary transition-colors duration-300"
              >
                忘记密码？
              </a>
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
              {loading ? "登录中..." : "登录"}
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-on-surface-variant">
              还没有账号？
              <Link
                href="/signup"
                className="font-medium text-primary hover:text-secondary underline decoration-1 underline-offset-4 transition-colors duration-300 ml-1"
              >
                立即注册
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
