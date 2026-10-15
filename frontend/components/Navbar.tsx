"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Sliders, Sparkles, BarChart3, Target, WifiOff, Wifi } from "lucide-react";
import { checkBackendHealth } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const verifyHealth = async () => {
      const ok = await checkBackendHealth();
      if (mounted) setIsBackendHealthy(ok);
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { name: "1. Dataset Ingestion", href: "/", icon: Database },
    { name: "2. Model Training", href: "/configure", icon: Sliders },
    { name: "3. Results & Evaluation", href: "/results", icon: BarChart3 },
    { name: "4. Predict", href: "/predict", icon: Target },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">ML Playground</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
              FastAPI + Next.js
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-800 px-3 py-1.5 rounded-full">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendHealthy === null
                ? "bg-slate-500 animate-pulse"
                : isBackendHealthy
                ? "bg-emerald-500 animate-pulse"
                : "bg-rose-500"
            }`}
          ></span>
          <span>
            {isBackendHealthy === null
              ? "Checking 127.0.0.1:8000..."
              : isBackendHealthy
              ? "Backend: Online"
              : "Backend: Offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
