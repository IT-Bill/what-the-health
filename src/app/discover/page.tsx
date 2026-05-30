"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import type { PostCard } from "@/lib/post-types";

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "mindfulness", label: "正念" },
  { id: "nutrition", label: "营养" },
  { id: "sleep", label: "睡眠" },
  { id: "reflection", label: "反思" },
];

export default function DiscoverPage() {
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ category: activeCategory });
    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((data) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <section className="text-center flex flex-col gap-2">
          <h1 className="font-[var(--font-display)] text-3xl md:text-4xl font-semibold text-on-surface">
            发现
          </h1>
          <p className="text-base text-on-surface-variant">
            真实的健康旅程，安静的转变力量
          </p>
        </section>

        {/* Category Chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 ${
                activeCategory === cat.id
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Posts Grid — 2 columns on md+ */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-primary-container rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-4 block">article</span>
            <p>暂无内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {posts.map((post) => (
              <PostCardComponent key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PostCardComponent({ post }: { post: PostCard }) {
  return (
    <Link href={`/discover/${post.id}`} className="group">
      <article className="bg-primary-container rounded-2xl overflow-hidden ambient-shadow transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(45,45,45,0.06)] flex flex-col h-full">
        {/* Cover Image */}
        {post.coverImage && (
          <div className="relative h-48 overflow-hidden bg-surface-variant">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Category badge */}
            <div className="absolute top-3 left-3 glass-panel px-3 py-1 rounded-xl flex items-center gap-1.5">
              {post.categoryIcon && (
                <span className="material-symbols-outlined text-sm text-tertiary">
                  {post.categoryIcon}
                </span>
              )}
              <span className="text-xs text-tertiary font-medium uppercase tracking-wider">
                {post.category}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          <h2 className="font-[var(--font-display)] text-lg font-medium text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2">
              {post.excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-outline-variant/10">
            {/* Author */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-container-high overflow-hidden relative">
                {post.author.avatarUrl ? (
                  <Image
                    src={post.author.avatarUrl}
                    alt={post.author.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-xs text-on-surface-variant absolute inset-0 flex items-center justify-center">
                    person
                  </span>
                )}
              </div>
              <span className="text-xs text-on-surface-variant">{post.author.name}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-on-surface-variant">
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-sm">favorite</span>
                {post._count.likes}
              </span>
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-sm">chat_bubble</span>
                {post._count.comments}
              </span>
              <span>{post.readMinutes} min</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
