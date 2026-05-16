"use client";

/**
 * 스냅샷·캐시로 본문은 유지한 채 백그라운드 갱신 중일 때만 상단에 표시.
 */

type Tone = "sky" | "amber" | "violet" | "emerald";

const BAR: Record<Tone, string> = {
  sky: "from-sky-500/25 via-sky-400 to-cyan-400/90 shadow-[0_0_12px_rgba(56,189,248,0.4)]",
  amber: "from-amber-500/25 via-amber-400 to-orange-400/90 shadow-[0_0_12px_rgba(251,191,36,0.35)]",
  violet: "from-violet-500/25 via-violet-400 to-fuchsia-400/90 shadow-[0_0_12px_rgba(167,139,250,0.35)]",
  emerald: "from-emerald-500/25 via-emerald-400 to-teal-400/90 shadow-[0_0_12px_rgba(52,211,153,0.35)]",
};

export default function StaleRefreshIndicator({
  show,
  tone = "sky",
}: {
  show: boolean;
  tone?: Tone;
}) {
  if (!show) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] bg-white/[0.06] pointer-events-none overflow-hidden"
      aria-hidden
    >
      <div
        className={`tab-sync-indicator__bar h-full w-[42%] rounded-full bg-gradient-to-r ${BAR[tone]}`}
      />
    </div>
  );
}
