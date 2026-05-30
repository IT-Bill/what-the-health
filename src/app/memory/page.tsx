"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";

interface Reaction {
  id: string;
  icon: string;
  label: string;
}

const reactions: Reaction[] = [
  { id: "inspired", icon: "lightbulb", label: "我有启发" },
  { id: "resonate", icon: "favorite", label: "感同身受" },
  { id: "try", icon: "directions_walk", label: "值得尝试" },
];

export default function MemoryPage() {
  const [selectedReactions, setSelectedReactions] = useState<string[]>([]);
  const [note, setNote] = useState("");

  function toggleReaction(id: string) {
    setSelectedReactions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-20">
        {/* Storyline End */}
        <section className="max-w-2xl mx-auto w-full">
          <div className="bg-primary-container rounded-3xl p-8 md:p-12 ambient-shadow relative overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-surface-container-low rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-1000" />
            <h2 className="font-[var(--font-display)] text-3xl font-medium text-primary mb-8 relative z-10">
              A Quiet Conclusion
            </h2>
            <div className="space-y-6 text-on-surface-variant text-lg leading-relaxed relative z-10">
              <p>
                The noise of the day finally settles, leaving behind a profound
                stillness. It is in these moments of pause that we truly hear
                ourselves. The journey wasn&apos;t about reaching a destination,
                but learning to walk with a gentler stride.
              </p>
              <p>
                As the light shifts, casting soft shadows across the room, you
                realize the weight you&apos;ve been carrying has imperceptibly
                lightened.
              </p>
            </div>
          </div>
        </section>

        {/* Interaction Zone */}
        <section className="max-w-2xl mx-auto w-full flex flex-col gap-8">
          <div className="text-center">
            <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2">
              这一刻的共鸣
            </h3>
            <p className="text-base text-on-surface-variant">
              What resonates with you right now?
            </p>
          </div>

          {/* Quick Reactions */}
          <div className="flex flex-wrap justify-center gap-4">
            {reactions.map((reaction) => (
              <button
                key={reaction.id}
                onClick={() => toggleReaction(reaction.id)}
                className={`px-6 py-3 rounded-full border text-sm font-medium tracking-wide transition-all duration-300 active:scale-95 flex items-center gap-2 ${
                  selectedReactions.includes(reaction.id)
                    ? "bg-surface-variant/40 border-secondary/50"
                    : "border-outline-variant/30 text-on-surface hover:bg-surface-variant/20"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={
                    selectedReactions.includes(reaction.id)
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {reaction.icon}
                </span>
                {reaction.label}
              </button>
            ))}
          </div>

          {/* Personal Note */}
          <div className="mt-4">
            <label htmlFor="memory-note" className="sr-only">
              Record your feelings
            </label>
            <textarea
              id="memory-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录下此刻的感受，我们会为您铭记..."
              rows={4}
              className="w-full bg-surface-container-low border border-transparent focus:border-secondary focus:ring-0 rounded-2xl p-6 text-lg text-on-surface placeholder:text-outline resize-none transition-colors duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
            />
          </div>

          {/* Action Button */}
          <div className="mt-8 flex justify-center">
            <button className="bg-inverse-surface text-inverse-on-surface px-12 py-4 rounded-full text-sm font-medium tracking-widest uppercase hover:opacity-90 hover:shadow-lg transition-all duration-300 active:scale-95 w-full md:w-auto min-w-[240px]">
              沉淀记忆
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
