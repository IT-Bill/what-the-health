"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import type { ShopApiResponse } from "@/lib/shop-types";

const SHOP_TABS = ["积分兑换", "赚取规则", "积分明细"] as const;
type ShopSubTab = (typeof SHOP_TABS)[number];

export default function ShopPage() {
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
        <div className="h-20 bg-primary-container rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-primary-container rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-on-surface-variant">加载失败</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease]">
      {/* Balance Header */}
      <div className="bg-primary-container rounded-2xl p-6 ambient-shadow flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-widest">可用积分</p>
          <p className="text-3xl font-[var(--font-display)] font-bold text-on-surface mt-1">
            {data.balance.toLocaleString()}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center">
          <Icon name="star" size={24} className="text-secondary" />
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {SHOP_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap ${
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
    <div className="grid grid-cols-2 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} balance={balance} />
      ))}
    </div>
  );
}

function ShopRules({ rules }: { rules: ShopApiResponse["rules"] }) {
  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
            <Icon name={rule.icon || "star"} size={20} className="text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-surface">{rule.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{rule.description}</p>
          </div>
          <span className="text-sm font-bold text-secondary whitespace-nowrap">
            +{rule.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function ShopHistory({ transactions }: { transactions: ShopApiResponse["recentTransactions"] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <p>暂无积分记录</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between py-3 border-b border-on-surface-variant/5 last:border-b-0">
          <div>
            <p className="text-sm text-on-surface">{tx.note || tx.action}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {new Date(tx.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <span className={`text-sm font-medium ${tx.direction === "earn" ? "text-secondary" : "text-error"}`}>
            {tx.direction === "earn" ? "+" : "-"}{tx.amount}
          </span>
        </div>
      ))}
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
          <div className="absolute inset-0 bg-surface/50 flex items-center justify-center">
            <span className="text-xs font-medium text-on-surface-variant bg-surface/80 px-3 py-1 rounded-full">
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
