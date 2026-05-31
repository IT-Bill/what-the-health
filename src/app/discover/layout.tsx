"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

const NAV_TABS = [
  { href: "/discover", label: "文章" },
  { href: "/discover/shop", label: "商城" },
  { href: "/discover/friends", label: "好友" },
  { href: "/discover/family", label: "家庭" },
];

// Pages that should show the tab navigation
const TAB_PAGES = ["/discover", "/discover/shop", "/discover/friends", "/discover/family"];

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showTabs = TAB_PAGES.includes(pathname);

  function isActive(href: string) {
    if (href === "/discover") return pathname === "/discover";
    return pathname.startsWith(href);
  }

  // Sub-pages (post detail, new post, family detail, friend detail) render without tabs/shell
  if (!showTabs) {
    return <>{children}</>;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {/* Tab Navigation */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 self-center">
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive(tab.href)
                  ? "bg-surface text-on-surface ambient-shadow"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Page Content */}
        {children}
      </div>
    </AppShell>
  );
}
