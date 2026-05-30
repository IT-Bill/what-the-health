"use client";

import { useState } from "react";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";

interface HealthConnection {
  id: string;
  icon: string;
  name: string;
  connected: boolean;
  type: "toggle" | "button";
}

const healthConnections: HealthConnection[] = [
  { id: "apple", icon: "favorite", name: "Apple Health", connected: true, type: "toggle" },
  { id: "garmin", icon: "watch", name: "Garmin Connect", connected: false, type: "button" },
  { id: "oura", icon: "radio_button_unchecked", name: "Oura Ring", connected: true, type: "toggle" },
];

export default function ProfilePage() {
  const [connections, setConnections] = useState(healthConnections);

  function toggleConnection(id: string) {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, connected: !c.connected } : c))
    );
  }

  return (
    <AppShell>
      <div className="max-w-screen-md mx-auto">
        {/* Profile Header */}
        <section className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 rounded-full overflow-hidden mb-6 glass-panel ambient-shadow relative bg-primary-container">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCu1L5PhcyvXkq-if97lnZrMAo_0or3u9KDmFjRvDiT50M3M-8zyJjqK8EU62PW6jQkW1qoW0oaXuMM1nRHGWeimOOQpKZgfehK-YXk0_aaiyB34NNj_5U7n7S2grOXOf7OFUOUdyo3NK37rC-cgotBgf7frr5AHzFiAvj_DqGJx9s-CeELcS18ZYK6IvgZ-589Lb4-A6CsD69GFJF3KJjWErWGUso1KZ2vSvUR_r2ZXWBCnpduXK8_XspZEPol1gtTSxA5Tw3Nsjw"
              alt="Profile Avatar"
              fill
              className="object-cover"
            />
          </div>
          <h2 className="font-[var(--font-display)] text-3xl font-medium text-on-surface mb-2">
            Elena Rostova
          </h2>
          <p className="text-sm font-medium text-on-surface-variant uppercase tracking-widest">
            Member since 2021
          </p>
        </section>

        {/* Personal Information */}
        <section className="mb-6">
          <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
            Personal Information
          </h3>
          <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
            <InfoRow label="Name" value="Elena Rostova" />
            <InfoRow label="Gender" value="Female" />
            <InfoRow label="Birthday" value="Oct 12, 1990" />
            <InfoRow label="Vitals" value="170 cm / 62 kg" last />
          </div>
        </section>

        {/* Health Connections */}
        <section className="mb-6 pt-8">
          <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
            Health Connections
          </h3>
          <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
            {connections.map((conn, index) => (
              <div
                key={conn.id}
                className={`flex justify-between items-center py-4 ${
                  index < connections.length - 1
                    ? "border-b border-on-surface-variant/10"
                    : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
                    <span className="material-symbols-outlined">
                      {conn.icon}
                    </span>
                  </div>
                  <span className="text-lg text-on-surface">{conn.name}</span>
                </div>
                {conn.type === "toggle" ? (
                  <button
                    onClick={() => toggleConnection(conn.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                      conn.connected ? "bg-secondary" : "bg-surface-variant"
                    }`}
                    aria-label={`Toggle ${conn.name}`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 transition-all duration-300 ${
                        conn.connected
                          ? "right-0.5 border-secondary"
                          : "left-0.5 border-outline-variant"
                      }`}
                    />
                  </button>
                ) : (
                  <button className="text-sm font-medium text-secondary border border-secondary/30 rounded-full px-4 py-1 hover:bg-secondary/5 transition-colors">
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-32 pt-8">
          <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2 px-4">
            Preferences
          </h3>
          <div className="bg-primary-container rounded-[2rem] p-8 ambient-shadow flex flex-col gap-4">
            <PrefRow icon="notifications" label="Notifications" />
            <PrefRow icon="lock" label="Privacy & Security" last />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      } group cursor-pointer hover:opacity-70 transition-opacity`}
    >
      <span className="text-lg text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-lg text-on-surface">{value}</span>
        <span className="material-symbols-outlined text-outline text-[18px]">
          chevron_right
        </span>
      </div>
    </div>
  );
}

function PrefRow({
  icon,
  label,
  last = false,
}: {
  icon: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-4 ${
        !last ? "border-b border-on-surface-variant/10" : ""
      } group cursor-pointer hover:opacity-70 transition-opacity`}
    >
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-outline">{icon}</span>
        <span className="text-lg text-on-surface">{label}</span>
      </div>
      <span className="material-symbols-outlined text-outline text-[18px]">
        chevron_right
      </span>
    </div>
  );
}
