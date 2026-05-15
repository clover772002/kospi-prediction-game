"use client";

import { useEffect, useState } from "react";
import AppAmbientBackground from "@/components/AppAmbientBackground";

type Accent = "blue" | "green" | "amber" | "violet";

const BAR_CLASS: Record<Accent, string> = {
  blue: "bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
  green: "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_18px_rgba(52,211,153,0.3)]",
  amber: "bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_18px_rgba(251,191,36,0.28)]",
  violet: "bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-[0_0_18px_rgba(167,139,250,0.35)]",
};

interface PageLoadProgressProps {
  /** 화면 상단 짧은 안내 */
  label?: string;
  accent?: Accent;
}

/**
 * 탭 전환 시 전체 화면 로딩: 스피너 대신 0%→~92%까지 부드럽게 차는 게이지(실제 응답이 오면 화면 전환).
 */
export default function PageLoadProgress({
  label = "불러오는 중…",
  accent = "blue",
}: PageLoadProgressProps) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const target = 92 * (1 - Math.exp(-elapsed / 2400));
      setPct((prev) => (target > prev ? target : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const display = Math.min(100, Math.round(pct));

  return (
    <main className="relative max-w-md mx-auto min-h-screen flex items-center justify-center px-8">
      <AppAmbientBackground />
      <div className="relative z-10 w-full max-w-[300px] space-y-3 text-center">
        <p className="text-sm text-gray-300 font-medium">{label}</p>
        <div
          className="h-2.5 w-full rounded-full bg-white/[0.07] overflow-hidden ring-1 ring-white/[0.08]"
          role="progressbar"
          aria-valuenow={display}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full ${BAR_CLASS[accent]}`}
            style={{ width: `${display}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-500 tabular-nums tracking-tight">{display}%</p>
      </div>
    </main>
  );
}
