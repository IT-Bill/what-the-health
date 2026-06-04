"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useRouter } from "next/navigation";

interface MoodOption {
  id: string;
  icon: string;
  label: string;
  labelEn: string;
  color: string;
}

const moods: MoodOption[] = [
  { id: "calm", icon: "water_drop", label: "平静", labelEn: "Calm", color: "text-secondary" },
  { id: "anxious", icon: "waves", label: "焦虑", labelEn: "Anxious", color: "text-tertiary" },
  { id: "fatigued", icon: "battery_0_bar", label: "疲惫", labelEn: "Fatigued", color: "text-primary" },
];

const goals = ["缓解焦虑", "改善体能", "平衡生活"];

export default function OnboardingMoodPage() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimalist Header */}
      <header className="fixed top-0 left-0 w-full z-40 px-6 md:px-16 h-24 flex items-center justify-center">
        <h1 className="font-[var(--font-display)] text-2xl font-medium text-primary tracking-tight">
          WiTH
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 md:px-16 pt-32 pb-32 max-w-[1200px] mx-auto w-full">
        <div className="w-full max-w-md space-y-20">
          {/* Mood Selection */}
          <section className="space-y-8 text-center">
            <h2 className="font-[var(--font-display)] text-3xl font-medium text-on-surface">
              今日，你的心境如何？
            </h2>
            <div className="flex flex-col gap-4">
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => setSelectedMood(mood.id)}
                  className={`group w-full bg-primary-container rounded-2xl p-8 flex items-center justify-between border border-outline-variant/30 relative overflow-hidden transition-all duration-500 ${
                    selectedMood === mood.id
                      ? "bg-secondary-container scale-[0.98] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"
                      : "hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(45,45,45,0.04)]"
                  }`}
                >
                  <div className="flex items-center gap-6 z-10">
                    <div className="w-12 h-12 rounded-full bg-surface-bright flex items-center justify-center">
                      <Icon name={mood.icon} className={mood.color} size={28} />
                    </div>
                    <span className="text-lg text-on-surface">{mood.label}</span>
                  </div>
                  <span className="text-xs text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {mood.labelEn}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Goal Selection (appears after mood) */}
          <section
            className={`space-y-8 text-center transition-all duration-800 ${
              selectedMood
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-5 pointer-events-none"
            }`}
          >
            <h2 className="font-[var(--font-display)] text-3xl font-medium text-on-surface">
              我们的目标是？
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {goals.map((goal) => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`px-6 py-3 rounded-full border border-outline-variant/50 text-base transition-all duration-300 ${
                    selectedGoals.includes(goal)
                      ? "bg-secondary text-on-secondary border-secondary"
                      : "text-on-surface hover:bg-surface-variant/30"
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
            <div className="pt-12">
              <button
                onClick={() => router.push("/onboarding/goal")}
                className="bg-surface-tint text-on-primary px-8 py-4 rounded-full text-sm font-medium tracking-wider hover:opacity-90 transition-opacity shadow-sm"
              >
                继续
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
