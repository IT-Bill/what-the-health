"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GoalOption {
  id: string;
  title: string;
  description: string;
  image: string;
}

const goalOptions: GoalOption[] = [
  {
    id: "build_muscle",
    title: "Build Muscle",
    description: "Enhance strength and physical resilience.",
    image: "/api/assets/static/pages/goal-muscle.webp",
  },
  {
    id: "lose_weight",
    title: "Lose Weight",
    description: "Achieve balance and lightness in your body.",
    image: "/api/assets/static/pages/goal-weight.webp",
  },
  {
    id: "healthy_habits",
    title: "Healthy Habits",
    description: "Cultivate consistency and long-term wellbeing.",
    image: "/api/assets/static/pages/goal-habits.webp",
  },
];

export default function OnboardingGoalPage() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col pb-32 relative">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-surface flex items-center justify-between px-6 py-4 z-40">
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="text-outline hover:opacity-80 transition-opacity p-2 rounded-full"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <h1 className="font-[var(--font-display)] text-2xl font-medium text-primary absolute left-1/2 -translate-x-1/2">
          Mindful
        </h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center px-6 md:px-16 pt-12 md:pt-24 max-w-4xl mx-auto w-full">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="font-[var(--font-display)] text-3xl md:text-4xl font-medium text-on-surface mb-4">
            What is your primary goal?
          </h2>
          <p className="text-lg text-on-surface-variant max-w-lg mx-auto leading-relaxed">
            Select the path that best aligns with your current wellness journey.
            We&apos;ll tailor your experience accordingly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full md:w-5/6 mx-auto">
          {goalOptions.map((goal, index) => (
            <label
              key={goal.id}
              className={`group relative cursor-pointer ${
                index === 2 ? "md:col-span-2 md:w-1/2 md:mx-auto" : ""
              }`}
            >
              <input
                type="radio"
                name="goal"
                value={goal.id}
                checked={selectedGoal === goal.id}
                onChange={() => setSelectedGoal(goal.id)}
                className="peer sr-only"
              />
              <div className="h-full bg-primary-container rounded-2xl md:rounded-3xl p-8 ambient-shadow transition-all duration-500 ease-out border border-transparent peer-checked:border-secondary peer-checked:bg-surface-container-low hover:bg-surface-container-low flex flex-col items-center justify-center text-center gap-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                  <img
                    src={goal.image}
                    alt={goal.title}
                    className="w-full h-full object-cover rounded-full opacity-80 mix-blend-multiply"
                  />
                </div>
                <div>
                  <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2">
                    {goal.title}
                  </h3>
                  <p className="text-base text-on-surface-variant">
                    {goal.description}
                  </p>
                </div>
                {/* Check indicator */}
                <div className="absolute top-6 right-6 w-6 h-6 rounded-full border-2 border-outline-variant peer-checked:border-secondary peer-checked:bg-secondary flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-white text-[16px] opacity-0 peer-checked:opacity-100">
                    check
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-surface/80 backdrop-blur-xl border-t border-outline-variant/30">
        <button
          onClick={() => router.back()}
          className="flex flex-col items-center justify-center text-on-surface-variant px-6 py-2 hover:opacity-80 transition-opacity text-sm font-medium"
        >
          <span className="material-symbols-outlined mb-1">arrow_back</span>
          Back
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex flex-col items-center justify-center bg-primary text-on-primary rounded-full px-6 py-2 hover:bg-primary/90 transition-all duration-300 active:scale-95 text-sm font-medium"
        >
          <span className="material-symbols-outlined mb-1">arrow_forward</span>
          Next
        </button>
      </nav>
    </div>
  );
}
