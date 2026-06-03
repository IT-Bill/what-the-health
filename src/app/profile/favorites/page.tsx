"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface FavoriteItem {
  id: string;
  createdAt: string;
  post: {
    id: string;
    title: string;
    excerpt: string | null;
    coverImage: string | null;
    category: string;
    categoryIcon: string | null;
    readMinutes: number;
    publishedAt: Date;
    author: { name: string };
  };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/favorites")
      .then((res) => res.json())
      .then((data) => {
        if (data.favorites) setFavorites(data.favorites);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleUnfavorite(postId: string, favoriteId: string) {
    try {
      const res = await fetch(`/api/posts/${postId}/favorite`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
      }
    } catch (err) {
      console.error("取消收藏失败:", err);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="我的收藏" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-primary-container rounded-2xl h-72 animate-pulse"
              />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {favorites.map((item) => (
              <FavoriteCard
                key={item.id}
                item={item}
                onUnfavorite={() => handleUnfavorite(item.post.id, item.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FavoriteCard({
  item,
  onUnfavorite,
}: {
  item: FavoriteItem;
  onUnfavorite: () => void;
}) {
  return (
    <div className="group relative">
      <Link href={`/discover/post/${item.post.id}`}>
        <article className="bg-primary-container rounded-2xl overflow-hidden ambient-shadow transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(45,45,45,0.06)] flex flex-col h-full">
          {item.post.coverImage ? (
            <div className="relative h-32 overflow-hidden bg-surface-variant">
              <img
                src={item.post.coverImage}
                alt={item.post.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-2 left-2 glass-panel px-2 py-0.5 rounded-lg flex items-center gap-1">
                {item.post.categoryIcon && (
                  <Icon
                    name={item.post.categoryIcon}
                    size={14}
                    className="text-tertiary"
                  />
                )}
                <span className="text-[10px] text-tertiary font-medium uppercase tracking-wider">
                  {item.post.category}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-32 bg-surface-container flex items-center justify-center">
              <Icon
                name="article"
                size={32}
                className="text-outline-variant"
              />
            </div>
          )}
          <div className="p-4 flex flex-col gap-2 flex-1">
            <h2 className="text-sm font-medium text-on-surface line-clamp-2 leading-snug">
              {item.post.title}
            </h2>
            {item.post.excerpt && (
              <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                {item.post.excerpt}
              </p>
            )}
            <div className="flex items-center justify-between mt-auto pt-3">
              <span className="text-[10px] text-on-surface-variant">
                {item.post.author.name}
              </span>
              <span className="text-[10px] text-outline">
                {item.post.readMinutes} min
              </span>
            </div>
          </div>
        </article>
      </Link>

      {/* Unfavorite button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnfavorite();
        }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-error-container"
        title="取消收藏"
      >
        <Icon name="bookmark_remove" size={16} className="text-on-surface" />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
        <Icon name="bookmark_border" size={28} className="text-outline" />
      </div>
      <h3 className="text-lg font-medium text-on-surface mb-2">
        还没有收藏
      </h3>
      <p className="text-sm text-on-surface-variant mb-6 max-w-xs leading-relaxed">
        在 Discover 浏览文章时，点击收藏按钮，就可以在这里找到它们
      </p>
      <Link
        href="/discover/post"
        className="px-6 py-3 rounded-full bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity"
      >
        去 Discover 看看
      </Link>
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
      <h1 className="font-[var(--font-display)] text-xl font-medium text-on-surface flex-1 text-center px-4">
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
