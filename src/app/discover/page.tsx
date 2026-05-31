"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import type { PostCard } from "@/lib/post-types";
import type { ShopApiResponse } from "@/lib/shop-types";

// --- Top-level tabs ---
const TOP_TABS = ["文章", "商城"] as const;
type TopTab = (typeof TOP_TABS)[number];

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "mindfulness", label: "正念" },
  { id: "nutrition", label: "营养" },
  { id: "sleep", label: "睡眠" },
  { id: "reflection", label: "反思" },
];

export default function DiscoverPage() {
  const [topTab, setTopTab] = useState<TopTab>("文章");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => { if (r.ok) setIsLoggedIn(true); })
      .catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {/* Top Tab Switch */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 self-center">
          {TOP_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTopTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                topTab === tab
                  ? "bg-surface text-on-surface ambient-shadow"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {topTab === "文章" ? <PostsTab isLoggedIn={isLoggedIn} /> : <ShopTab isLoggedIn={isLoggedIn} />}
      </div>
    </AppShell>
  );
}

// ============================================================================
// Posts Tab (existing functionality)
// ============================================================================

function PostsTab({ isLoggedIn }: { isLoggedIn: boolean }) {
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

  function handleCreatePost() {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    // TODO: navigate to post creation page
    window.location.href = "/discover/new";
  }

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease] relative">
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
          <span className="material-symbols-outlined text-5xl mb-4 block">article</span>
          <p>暂无内容</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-5">
          {posts.map((post) => (
            <PostCardComponent key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* FAB — Create Post */}
      <button
        onClick={handleCreatePost}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center ambient-shadow hover:opacity-90 active:scale-95 transition-all duration-300 z-40"
        aria-label="发布文章"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
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
                <span className="material-symbols-outlined text-xs text-tertiary">
                  {post.categoryIcon}
                </span>
              )}
              <span className="text-[10px] text-tertiary font-medium uppercase tracking-wider">
                {post.category}
              </span>
            </div>
          </div>
        )}
        <div className="p-3 md:p-5 flex flex-col flex-1 gap-2">
          <h2 className="[font-family:var(--font-display)] text-sm md:text-lg font-medium text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed line-clamp-2 hidden sm:block">
              {post.excerpt}
            </p>
          )}
          <div className="mt-auto pt-2 md:pt-3 flex items-center justify-between border-t border-outline-variant/10">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-surface-container-high overflow-hidden relative">
                {post.author.avatarUrl ? (
                  <img src={post.author.avatarUrl} alt={post.author.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-xs text-on-surface-variant absolute inset-0 flex items-center justify-center">person</span>
                )}
              </div>
              <span className="text-[10px] md:text-xs text-on-surface-variant truncate max-w-[60px] md:max-w-none">
                {post.author.name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-on-surface-variant">
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs md:text-sm">favorite</span>
                {post._count.likes}
              </span>
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs md:text-sm">chat_bubble</span>
                {post._count.comments}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ============================================================================
// Shop Tab (credits system)
// ============================================================================

const SHOP_TABS = ["积分兑换", "赚取规则", "积分明细"] as const;
type ShopSubTab = (typeof SHOP_TABS)[number];

function ShopTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [data, setData] = useState<ShopApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<ShopSubTab>("积分兑换");

  useEffect(() => {
    fetch("/api/shop")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="bg-primary-container rounded-2xl h-32" />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-container rounded-2xl h-64" />
          <div className="bg-primary-container rounded-2xl h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl mb-4 block">error</span>
        <p>加载失败</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease]">
      {/* Balance Hero */}
      <section className="bg-primary-container rounded-2xl p-6 md:p-8 ambient-shadow text-center">
        {isLoggedIn ? (
          <>
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">
              可用余额
            </span>
            <div className="flex items-baseline justify-center gap-2 mt-2">
              <span className="[font-family:var(--font-display)] text-5xl font-semibold text-on-surface">
                {data.balance.toLocaleString()}
              </span>
              <span className="[font-family:var(--font-display)] text-xl font-medium text-outline">
                Cr
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-3 max-w-sm mx-auto">
              坚持健康习惯获取积分，兑换精选好物
            </p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-4xl text-outline mb-2">account_circle</span>
            <p className="text-base text-on-surface mb-3">登录后查看你的积分余额</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-sm font-medium hover:opacity-90 transition-opacity"
            >
              去登录
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </>
        )}
      </section>

      {/* Sub Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {SHOP_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap ${
              activeSubTab === tab
                ? "bg-secondary-container text-on-secondary-container"
                : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sub Tab Content */}
      {activeSubTab === "积分兑换" && <ShopProducts products={data.products} balance={data.balance} />}
      {activeSubTab === "赚取规则" && <ShopRules rules={data.rules} />}
      {activeSubTab === "积分明细" && <ShopHistory transactions={data.recentTransactions} />}
    </div>
  );
}

function ShopProducts({ products, balance }: { products: ShopApiResponse["products"]; balance: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-[fadeIn_0.3s_ease]">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} balance={balance} />
      ))}
    </div>
  );
}

function ShopRules({ rules }: { rules: ShopApiResponse["rules"] }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 md:p-6 border border-outline-variant/20 animate-[fadeIn_0.3s_ease]">
      <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-4">
        如何赚取积分
      </h3>
      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-b-0">
            <div className="w-9 h-9 rounded-xl bg-secondary-container/50 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-secondary text-lg">
                {rule.icon || "star"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">{rule.name}</p>
              <p className="text-xs text-on-surface-variant truncate">{rule.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-sm font-semibold text-secondary">+{rule.amount}</span>
              {rule.dailyCap > 0 && (
                <p className="text-[10px] text-on-surface-variant">每日{rule.dailyCap}次</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopHistory({ transactions }: { transactions: ShopApiResponse["recentTransactions"] }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 md:p-6 border border-outline-variant/20 animate-[fadeIn_0.3s_ease]">
      <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-4">
        最近积分变动
      </h3>
      {transactions.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">暂无记录</p>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-outline-variant/10 last:border-b-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface">{tx.note || tx.action}</p>
                <p className="text-[10px] text-on-surface-variant">
                  {new Date(tx.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-sm font-semibold ${tx.direction === "earn" ? "text-secondary" : "text-error"}`}>
                  {tx.direction === "earn" ? "+" : "-"}{tx.amount}
                </span>
                <p className="text-[10px] text-on-surface-variant">余额 {tx.balance}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ProductCard({ product, balance }: { product: ShopApiResponse["products"][number]; balance: number }) {
  const canAfford = balance >= product.priceCredits;

  return (
    <article className="flex flex-col group cursor-pointer transition-all duration-500 hover:opacity-90">
      <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-surface-container-low mb-3 relative">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
        )}
        {!canAfford && (
          <div className="absolute inset-0 bg-surface/40 flex items-center justify-center">
            <span className="text-xs font-medium text-on-surface-variant bg-surface/80 px-2 py-1 rounded-lg">
              积分不足
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-start px-1 gap-1">
        <h3 className="text-sm font-medium text-on-surface line-clamp-1">{product.name}</h3>
        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{product.description}</p>
        <span className={`text-xs font-medium px-3 py-1 rounded-full mt-1 ${
          canAfford
            ? "text-secondary bg-secondary-container/50"
            : "text-on-surface-variant bg-surface-variant/30"
        }`}>
          {product.priceCredits.toLocaleString()} Cr
        </span>
      </div>
    </article>
  );
}
