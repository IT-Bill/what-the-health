"use client";

import { useState } from "react";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";

interface JourneyCard {
  id: string;
  category: string;
  categoryIcon: string;
  title: string;
  quote: string;
  author: string;
  readTime: string;
  image: string;
  avatar: string;
}

const journeys: JourneyCard[] = [
  {
    id: "1",
    category: "Mindfulness",
    categoryIcon: "spa",
    title: "上班族如何平缓度过减脂平台期",
    quote: `"从焦虑到接纳：小王的四周饮食记录"`,
    author: "Xiao Wang",
    readTime: "4 min read",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDrbmsXLYiSOteMdlrNGNJlhW7a2qFB-aL73C0EiFktcnJEEze9oOM1ISJYYa_XTWMSgoVYp_CLIujeiJncs1UcCEHFKa8IWd9qpay6YwuGngo1w5IMtarjhGP5uA8gkoP_2mz7cHqJnWcP2xy6VExf8GR7lkaYQ7t2iZ0QNM36oJFPxPdwXHA2SA55BobYQLakAKPSiVmtTbeWZfi7wYu9DwMJn8t37ZzSLj9TdxmD8T95IV3fr8QffSmfiFmALefx3x_FMTg2oXo",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDE_qoSpDao7VMBAeiSLqxL7LV_VVHjhlL5Lc2WQH4XrSaTTmwYgBIHO1PtbOkupTo871LmM0AmQRxugOp6At3lAg2YRc6mtf6oQ9VqDEcumkOg3qGhV53ozLiXaP_-8MNJnl9BCYdWiwyvDTySJIsqa9m_Mw_qt76_apAZZpzBj6yXpt5ai2LyI21XcoKUQI7zzzkHOqh0YpRtNlr-0FDzPo0pifDsuoHk91Ep6dIRJZ7m1hhHhBupyfZqRfOOJLbQyt53LfQ0g_U",
  },
  {
    id: "2",
    category: "Reflection",
    categoryIcon: "edit_note",
    title: "The Architecture of a Quiet Evening",
    quote: `"Reclaiming my nights from digital noise: A 30-day experiment in analog living."`,
    author: "Marcus L.",
    readTime: "6 min read",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBcJu1ooXwW1MLb-KSvybTdCNTyHRMtNB-5UNLBA1g0gsKOLwmddzQkOAUA7k_hdfOgpc6Mz1ekLz7iYFdGE3wQ6S9Vi0GOoZZn960pbzdn-TlrpzVKeyzhab5aBokSA5wLBfEl5YjbQfwDtJRcNIHyO-0t1IQCL93-NBMW6FsMDFUUy6X4amdm4Uz7b-vMz_kqt9f5onpfj34JQd0ezUkdb7mc58vqOSDBNLvZaXrPumW91ZIUwxSNUyTyXyZEIeosvpYVw3hLaAc",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAMyX9cJtfOwxThdhr4mBqRGV1dHxAP7TpD6WligWDidUkURRDn6HsRaxIjt2K3wCZuLOimovmAdkTorTcOQEpHapkZEnIiloU9qb1tOt3kI9iZZlPa2_AbVrVNv0R9bCtjXNDyBg2a52vV9z-GrWdZe7GPPWYbDPGaHxksVdMlEn4pCqkK3wTN79LS9sHA0xBAeHEf9vxMt9HTmwIYbyi0CrTN1Ptxq4B_dgzSKTHaqqLq1xDqDQF51IjvRcpqaTa3g4756N8WzfI",
  },
  {
    id: "3",
    category: "Nutrition",
    categoryIcon: "restaurant_menu",
    title: "Finding Balance Without Restriction",
    quote: `"Learning to listen to my body instead of counting macros."`,
    author: "Sarah J.",
    readTime: "5 min read",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCPP02i2HR4CCVgIFydvZ86zcxyiPibwltISdQcmqIbNMhE_YbBKHTaUdALvxp8dK7etipdHysd6MOmIL2fpV8isPswp7yMoejaC4GvH-xLp1bqS95Xog5rIOd2X-j8OxTyt_1Ep49YJEmTls5U9NC0wCO3YjQq_jvpqyT0CXRNY-Y0EA2h8bVlJD1R-zWGg48NhZ-awsBOqpWQCVsxINX2TpgbLISZwuH5UVlx_daAs7dO3wt4zHh-9irv2HWLhz3SZRfRtmk_VJ0",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAOytiVKcjHhk6OVZPIIJwyIGAuX5IARCMXg5mZQ1hWh4AjOHMg77wiJn7Rnsf7Hpp_yWraNcNfzJ1IcR3WN6zZXxpm-tey0AMYp7qopQnnSpZKHy7bWDOTTx7Hi1iVMGZl2gA9gz1yy6JF1cNRU3R_JeDBxaAEn6CzfVnLZ8xSbT66FrHsGs8ngo3cOhfj-Jvg-ZyTBCCeEs5PG-gOEjS5AcQgMpkMVVvIIdAQbFxH655GDh90YVoYfFOx5tD2AHx5ssfR9BHv9sg",
  },
];

const categories = ["All Journeys", "Mindfulness", "Nutrition", "Sleep & Rest"];

export default function DiscoverPage() {
  const [activeCategory, setActiveCategory] = useState("All Journeys");

  return (
    <AppShell>
      <div className="flex flex-col gap-20">
        {/* Page Header */}
        <section className="max-w-[800px] mx-auto text-center flex flex-col gap-2">
          <h1 className="font-[var(--font-display)] text-3xl md:text-5xl font-semibold text-on-surface leading-tight">
            Inspiration & Resonance
          </h1>
          <p className="text-base md:text-lg text-on-surface-variant">
            Real journeys of quiet transformation and mindful healing.
          </p>
          {/* Category Chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium tracking-wide transition-colors ${
                  activeCategory === cat
                    ? "bg-secondary-container/50 text-on-secondary-container"
                    : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Journey Feed */}
        <section className="flex flex-col gap-8 max-w-[900px] mx-auto w-full">
          {journeys.map((journey, index) => (
            <JourneyArticle
              key={journey.id}
              journey={journey}
              reversed={index % 2 === 1}
            />
          ))}
        </section>

        {/* Load More */}
        <div className="flex justify-center">
          <button className="px-8 py-3 rounded-full border border-outline/30 text-on-surface text-sm font-medium tracking-wide hover:bg-surface-variant/20 transition-colors">
            Load More Journeys
          </button>
        </div>
      </div>

      {/* Decorative gradients */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-tertiary-container/30 rounded-full blur-[100px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-secondary-container/20 rounded-full blur-[120px] -z-10 pointer-events-none -translate-x-1/4 translate-y-1/4" />
    </AppShell>
  );
}

function JourneyArticle({
  journey,
  reversed,
}: {
  journey: JourneyCard;
  reversed: boolean;
}) {
  return (
    <article
      className={`flex flex-col ${
        reversed ? "md:flex-row-reverse" : "md:flex-row"
      } bg-primary-container rounded-[32px] overflow-hidden ambient-shadow group cursor-pointer transition-transform hover:-translate-y-1 duration-500`}
    >
      {/* Image */}
      <div className="md:w-2/5 h-[300px] md:h-auto relative overflow-hidden bg-surface-variant">
        <Image
          src={journey.image}
          alt={journey.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
        />
        <div
          className={`absolute top-4 ${
            reversed ? "right-4" : "left-4"
          } glass-panel px-3 py-1 rounded-full flex items-center gap-1`}
        >
          <span className="material-symbols-outlined text-sm text-tertiary">
            {journey.categoryIcon}
          </span>
          <span className="text-xs text-tertiary uppercase tracking-wider">
            {journey.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 md:w-3/5 flex flex-col justify-center gap-4">
        <h2 className="font-[var(--font-display)] text-2xl font-medium text-on-surface leading-snug">
          {journey.title}
        </h2>
        <p className="text-base text-on-surface-variant border-l-2 border-outline-variant/30 pl-4 py-1 italic">
          {journey.quote}
        </p>
        <div className="flex items-center gap-3 mt-4 text-on-surface-variant">
          <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden relative">
            <Image
              src={journey.avatar}
              alt={journey.author}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">
              {journey.author}
            </p>
            <p className="text-xs">{journey.readTime}</p>
          </div>
          <div className="ml-auto glass-panel w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </div>
      </div>
    </article>
  );
}
