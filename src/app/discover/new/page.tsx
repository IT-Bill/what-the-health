"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { id: "mindfulness", label: "正念", icon: "spa" },
  { id: "nutrition", label: "营养", icon: "restaurant_menu" },
  { id: "sleep", label: "睡眠", icon: "bedtime" },
  { id: "reflection", label: "反思", icon: "edit_note" },
];

export default function NewPostPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("mindfulness");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => {
        if (!r.ok) window.location.href = "/login";
        else setIsLoggedIn(true);
      })
      .catch(() => { window.location.href = "/login"; });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, body, category }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/discover/${data.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "发布失败");
      }
    } catch {
      alert("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-on-surface-variant">加载中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 h-14 border-b border-outline-variant/20">
        <Link
          href="/discover"
          className="text-on-surface hover:opacity-70 transition-opacity flex items-center gap-1"
        >
          <span className="material-symbols-outlined">close</span>
        </Link>
        <h1 className="[font-family:var(--font-display)] text-lg font-medium text-primary">
          发布文章
        </h1>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !body.trim()}
          className="px-4 py-1.5 rounded-full bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {submitting ? "发布中..." : "发布"}
        </button>
      </header>

      {/* Form */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-6 flex flex-col gap-5">
        {/* Category Selector */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                category === cat.id
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
              }`}
            >
              <span className="material-symbols-outlined text-base">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="w-full bg-transparent border-0 text-2xl [font-family:var(--font-display)] font-medium text-on-surface placeholder:text-outline-variant focus:ring-0 p-0"
        />

        {/* Excerpt */}
        <input
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="一句话摘要（可选）"
          className="w-full bg-transparent border-0 text-base text-on-surface-variant placeholder:text-outline-variant focus:ring-0 p-0"
        />

        {/* Divider */}
        <div className="border-t border-outline-variant/20" />

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="写下你的故事...&#10;&#10;支持简单格式：&#10;## 标题&#10;**加粗**&#10;- 列表项"
          rows={16}
          className="w-full bg-transparent border-0 text-base text-on-surface placeholder:text-outline-variant focus:ring-0 p-0 resize-none leading-relaxed"
        />
      </main>
    </div>
  );
}
