"use client";

import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex w-full min-h-screen">
      {/* Left Side: Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container overflow-hidden items-center justify-center">
        <Image
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCm97K8ZZvci6jBa0e8OmzlmnZNwGMD69Xa8Qd7v4ICA-DJnOZEzGUBKMaEuliXKSk_yVW7awtCRHtq-uAjHWdMzBJ_ER0biUEjl-OsIIhZ21v0zdKFcGglYCJtwJ_9FemAWWqfC5DsIRjnq8dXpm4fwg_k2d7BSOaKCORYdOjMQmwf7Wdksa4Ko8KFJ8bt7AGfwu4m3KPEsVdyMB79Lfx8ZPq2MAWltVITmBz8wElmVucXqWzb13APjlpnTtuC5ROrwtnx86M3tGA"
          alt="Serene minimal interior"
          fill
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
              Sérénité
            </h2>
            <h1 className="font-[var(--font-display)] text-3xl md:text-5xl font-semibold text-on-background leading-tight">
              Welcome to your sanctuary of calm
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed">
              Enter your details to continue your mindful journey.
            </p>
          </div>

          {/* Login Form */}
          <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-on-surface-variant mb-2 ml-4 tracking-wide"
                >
                  Email Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute inset-y-0 left-4 flex items-center text-outline-variant pointer-events-none">
                    mail
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="hello@example.com"
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
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute inset-y-0 left-4 flex items-center text-outline-variant pointer-events-none">
                    lock
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
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
                  Remember me
                </label>
              </div>
              <a
                href="#"
                className="text-sm font-medium text-primary hover:text-secondary transition-colors duration-300"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full flex justify-center py-4 px-8 border border-transparent rounded-full shadow-sm text-sm font-medium tracking-wide text-on-primary bg-inverse-surface hover:bg-on-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all duration-500 ease-out transform hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </form>

          {/* Footer */}
          <div className="pt-8 text-center border-t border-surface-variant/50">
            <p className="text-base text-on-surface-variant">
              New to Sérénité?{" "}
              <a
                href="#"
                className="text-sm font-medium text-primary hover:text-secondary underline decoration-1 underline-offset-4 transition-colors duration-300 ml-1"
              >
                Sign up here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
