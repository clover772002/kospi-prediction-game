"use client";

import { useEffect, useState } from "react";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import { pickRandomTip } from "@/lib/loadingPurposeTips";

type Accent = "blue" | "green" | "amber" | "violet";

const BAR_CLASS: Record<Accent, string> = {
  blue: "bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
  green: "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_18px_rgba(52,211,153,0.3)]",
  amber: "bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_18px_rgba(251,191,36,0.28)]",
  violet: "bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-[0_0_18px_rgba(167,139,250,0.35)]",
};

const TIP_ROTATE_MS = 3_200;

type Props = {
  label?: string;
  sublabel?: string;
  accent?: Accent;
  mode?: "progress" | "spinner";
  fullscreen?: boolean;
};

export default function LoadingPurposeSplash({
  label,
  sublabel,
  accent = "blue",
  mode = "spinner",
  fullscreen = false,
}: Props) {
  const [heroTip, setHeroTip] = useState(() => pickRandomTip());
  const [pct, setPct] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setHeroTip((prev) => pickRandomTip([prev.id]));
    }, TIP_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  useEffect(() => {
    if (mode !== "progress" || reducedMotion) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const t = 92 * (1 - Math.exp(-elapsed / 2400));
      setPct((prev) => (t > prev ? t : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, reducedMotion]);

  const shell = fullscreen
    ? "fixed inset-0 z-[10001]"
    : "relative max-w-md mx-auto min-h-screen w-full";

  const display = Math.min(100, Math.round(pct));

  return (
    <div
      className={`${shell} flex items-center justify-center overflow-hidden px-4`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? heroTip.text}
    >
      <AppAmbientBackground />

      <div className="relative z-10 w-full max-w-[320px] space-y-4 text-center">
        <div
          key={heroTip.id}
          className="loading-purpose-hero rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-4 backdrop-blur-sm"
        >
          <p className="text-3xl mb-2" aria-hidden>
            {heroTip.emoji}
          </p>
          <p className="text-base sm:text-lg font-black leading-snug text-white">{heroTip.text}</p>
        </div>

        {mode === "progress" ? (
          <div className="space-y-2">
            {label ? <p className="text-xs text-gray-400 font-medium">{label}</p> : null}
            <div
              className="h-2.5 w-full rounded-full bg-white/[0.07] overflow-hidden ring-1 ring-white/[0.08]"
              role="progressbar"
              aria-valuenow={display}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${BAR_CLASS[accent]}`}
                style={{ width: `${display}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 tabular-nums">{display}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400"
              aria-hidden
            />
            {label ? <p className="text-xs text-gray-400">{label}</p> : null}
          </div>
        )}

        {sublabel ? (
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-[280px] mx-auto">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}
