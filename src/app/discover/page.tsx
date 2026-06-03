"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import type { PostCard } from "@/lib/post-types";
import { Icon } from "@/components/icon";
import { useUser } from "@/lib/swr";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { data: userData } = useUser();
  const isLoggedIn = !!userData?.user;

  useEffect(() => {
    let cancelled = false;
    async function loadPosts() {
      setLoading(true);
      const params = new URLSearchParams({ category: activeCategory });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      try {
        const response = await fetch(`/api/posts?${params}`);
        const data = await response.json();
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPosts();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, searchQuery]);

  return (
    <AppShell
      topAppBarProps={{
        title: "发现",
        leftIcon: "alarm_clock",
        leftHref: "/reminders",
      }}
    >
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease] relative">
      {/* Search */}
      <div className="relative">
        <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索文章标题或摘要..."
          className="w-full bg-surface-container-low rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary border-0 transition-all"
        />
      </div>

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

      {/* Posts Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-primary-container rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-on-surface-variant">
          <Icon name="article" />
          <p>暂无内容</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-5">
          {posts.map((post) => (
            <PostCardComponent key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* FAB */}
      {isLoggedIn && (
        <Link
          href="/discover/new"
          className="fixed bottom-24 right-6 w-14 h-14 bg-secondary text-on-secondary rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-40"
        >
          <Icon name="add" size={24} />
        </Link>
      )}
    </div>
    </AppShell>
  );
}

function PostCardComponent({ post }: { post: PostCard }) {
  return (
    <Link href={`/discover/${post.id}`} className="group">
      <article className="bg-primary-container rounded-2xl overflow-hidden ambient-shadow transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(45,45,45,0.06)] flex flex-col h-full">
        {post.coverImage && (
          <div className="relative h-32 md:h-48 overflow-hidden bg-surface-variant">
            <img
              src={post.coverImage}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute top-2 left-2 glass-panel px-2 py-0.5 rounded-lg flex items-center gap-1">
              {post.categoryIcon && (
                <Icon name={post.categoryIcon} size={14} className="text-tertiary" />
              )}
              <span className="text-[10px] text-tertiary font-medium uppercase tracking-wider">
                {post.category}
              </span>
            </div>
          </div>
        )}
        <div className="p-4 md:p-5 flex flex-col gap-2 flex-1">
          <h2 className="text-sm md:text-base font-medium text-on-surface line-clamp-2 leading-snug">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed hidden md:block">
              {post.excerpt}
            </p>
          )}
          <div className="flex items-center justify-between mt-auto pt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-surface-container-high overflow-hidden relative">
                {post.author.avatarUrl ? (
                  <img src={post.author.avatarUrl} alt={post.author.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Icon name="person" size={12} className="text-on-surface-variant" />
                  </span>
                )}
              </div>
              <span className="text-[10px] md:text-xs text-on-surface-variant truncate max-w-[60px] md:max-w-none">
                {post.author.name}
              </span>
            </div>
            <span className="text-[10px] text-outline">{post.readMinutes} min</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
