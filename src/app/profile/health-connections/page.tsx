"use client";

import { useState } from "react";
import Link from "next/link";

interface HealthDevice {
  id: string;
  icon: string;
  name: string;
  description: string;
  connected: boolean;
  type: "toggle" | "button";
}

const initialDevices: HealthDevice[] = [
  {
    id: "apple",
    icon: "favorite",
    name: "Apple Health",
    description: "同步步数、心率、睡眠数据",
    connected: true,
    type: "toggle",
  },
  {
    id: "garmin",
    icon: "watch",
    name: "Garmin Connect",
    description: "同步运动、GPS、训练数据",
    connected: false,
    type: "button",
  },
  {
    id: "oura",
    icon: "radio_button_unchecked",
    name: "Oura Ring",
    description: "同步睡眠评分、 readiness",
    connected: true,
    type: "toggle",
  },
];

export default function HealthConnectionsPage() {
  const [devices, setDevices] = useState(initialDevices);

  function toggleDevice(id: string) {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, connected: !d.connected } : d))
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header title="健康连接" />

      <main className="flex-1 px-6 py-6 max-w-screen-md mx-auto w-full">
        <div className="bg-primary-container rounded-[2rem] p-6 ambient-shadow flex flex-col gap-1">
          {devices.map((device, index) => (
            <div
              key={device.id}
              className={`flex items-center justify-between py-5 ${
                index < devices.length - 1
                  ? "border-b border-on-surface-variant/10"
                  : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
                  <span className="material-symbols-outlined">
                    {device.icon}
                  </span>
                </div>
                <div>
                  <p className="text-base text-on-surface font-medium">
                    {device.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {device.description}
                  </p>
                </div>
              </div>
              {device.type === "toggle" ? (
                <button
                  onClick={() => toggleDevice(device.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                    device.connected ? "bg-secondary" : "bg-surface-variant"
                  }`}
                  aria-label={`Toggle ${device.name}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border-2 transition-all duration-300 ${
                      device.connected
                        ? "right-0.5 border-secondary"
                        : "left-0.5 border-outline-variant"
                    }`}
                  />
                </button>
              ) : (
                <button className="text-sm font-medium text-secondary border border-secondary/30 rounded-full px-4 py-1.5 hover:bg-secondary/5 transition-colors">
                  连接
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 h-16">
      <Link
        href="/profile"
        className="text-on-surface hover:opacity-70 transition-opacity active:scale-95 duration-300 flex items-center justify-center p-2 rounded-full -ml-2"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <h1 className="font-[var(--font-display)] text-xl font-medium text-on-surface ml-2">
        {title}
      </h1>
    </header>
  );
}
