"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icon";

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => {
        if (!r.ok) window.location.href = "/login";
        else setIsLoggedIn(true);
      })
      .catch(() => { window.location.href = "/login"; });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("图片大小不能超过 10MB");
      return;
    }

    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }

  function removeCover() {
    setCoverFile(null);
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);

    try {
      let coverImage: string | null = null;

      // Upload cover image first if selected
      if (coverFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", coverFile);
        const uploadRes = await fetch("/api/upload/image?prefix=posts", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error || "封面上传失败");
          setSubmitting(false);
          setUploading(false);
          return;
        }
        const uploadData = await uploadRes.json();
        coverImage = uploadData.url;
        setUploading(false);
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, body, category, coverImage }),
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
      setUploading(false);
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
          <Icon name="close" />
        </Link>
        <h1 className="[font-family:var(--font-display)] text-lg font-medium text-primary">
          发布文章
        </h1>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !body.trim()}
          className="px-4 py-1.5 rounded-full bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {uploading ? "上传中..." : submitting ? "发布中..." : "发布"}
        </button>
      </header>

      {/* Form */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-6 flex flex-col gap-5">
        {/* Cover Image Upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          {coverPreview ? (
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
              <Image
                src={coverPreview}
                alt="封面预览"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                onClick={removeCover}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Icon name="add_photo_alternate" size={32} />
              <span className="text-sm">添加封面图</span>
            </button>
          )}
        </div>

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
              <Icon name={cat.icon} />
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
          placeholder={"写下你的故事...\n\n支持简单格式：\n## 标题\n**加粗**\n- 列表项"}
          rows={16}
          className="w-full bg-transparent border-0 text-base text-on-surface placeholder:text-outline-variant focus:ring-0 p-0 resize-none leading-relaxed"
        />
      </main>
    </div>
  );
}
