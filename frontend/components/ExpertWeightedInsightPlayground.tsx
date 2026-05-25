"use client";

import { useEffect, useState } from "react";

const PHASE_MS = 720;
const N_PHASE = 6;

/** 로그인 랜딩: 투표 집계 → 고수 가중·하수 축소 → 고수강화예측 지표 예시 */
export default function ExpertWeightedInsightPlayground() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % N_PHASE), PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  const votesIn = phase >= 1;
  const weighting = phase >= 2;
  const barsLive = phase >= 3;
  const highlight = phase >= 4;

  const simplePct = 52;
  const weightedPct = barsLive ? (phase >= 4 ? 61 : 58) : 52;

  const voteDots = [
    { x: "8%", y: "18%", d: 0 },
    { x: "22%", y: "28%", d: 80 },
    { x: "38%", y: "14%", d: 160 },
    { x: "54%", y: "32%", d: 40 },
    { x: "68%", y: "20%", d: 120 },
    { x: "82%", y: "26%", d: 200 },
    { x: "46%", y: "42%", d: 280 },
    { x: "72%", y: "38%", d: 240 },
  ];

  const captions = [
    "참가자 투표가 쌓이는 중…",
    "맞춘 사람은 가중 ↑ · 틀린 사람은 가중 ↓",
    "단순 다수결 vs 고수 가중 예측",
    "새 지표 「고수강화예측」을 확인해 보세요",
  ];
  const captionIdx = phase <= 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : 3;

  return (
    <div
      className="w-full rounded-3xl border-2 border-violet-500/35 bg-gradient-to-b from-[#120818]/95 to-[#101010] overflow-hidden login-weighted-glow"
      aria-hidden
    >
      <div className="flex items-center justify-center px-4 py-2.5 bg-violet-500/10 border-b border-violet-500/20">
        <span className="text-base sm:text-lg font-black text-violet-200 tracking-wide">투표 → 가중 집계</span>
      </div>

      <div className="relative px-3 py-4 min-h-[14rem]">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/[0.08] via-transparent to-amber-500/[0.05] transition-opacity duration-500 ${
            highlight ? "opacity-100 login-weighted-aurora" : "opacity-30"
          }`}
        />

        {/* 투표 모이기 */}
        <div className="relative h-[4.5rem] mb-3 rounded-2xl border border-white/[0.06] bg-[#0a0a0c]/80 overflow-hidden">
          {voteDots.map((dot, i) => (
            <span
              key={i}
              className={`absolute text-lg sm:text-xl transition-all duration-500 login-vote-dot ${
                votesIn ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}
              style={{
                left: dot.x,
                top: dot.y,
                transitionDelay: `${dot.d}ms`,
              }}
            >
              {i % 3 === 0 ? "📈" : i % 3 === 1 ? "📉" : "🗳️"}
            </span>
          ))}
          <div
            className={`absolute inset-x-0 bottom-0 flex justify-center pb-2 transition-opacity duration-400 ${
              votesIn ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="text-xs sm:text-sm font-bold text-violet-300/90 tabular-nums">+128표 집계 중</span>
          </div>
        </div>

        {/* 고수 ↑ / 하수 ↓ */}
        <div className="flex justify-center gap-3 mb-3">
          <span
            className={`rounded-full px-3 py-1 text-sm sm:text-base font-black border transition-all duration-500 ${
              weighting
                ? "border-amber-400/50 bg-amber-500/15 text-amber-200 scale-105 login-weight-badge-up"
                : "border-white/10 bg-white/5 text-gray-500 scale-100"
            }`}
          >
            ⭐ 고수 가중 ↑
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm sm:text-base font-black border transition-all duration-500 ${
              weighting
                ? "border-slate-500/40 bg-slate-800/40 text-slate-400 scale-95 opacity-90"
                : "border-white/10 bg-white/5 text-gray-500"
            }`}
          >
            하수 가중 ↓
          </span>
        </div>

        {/* 단순 vs 가중 막대 */}
        <div className="space-y-2.5 rounded-2xl border border-violet-500/20 bg-[#0c0c0e]/90 px-3 py-3">
          <div className="flex items-center justify-between text-sm sm:text-base font-bold text-gray-500">
            <span>단순 다수결</span>
            <span className="tabular-nums text-sky-300/90">{simplePct}%</span>
          </div>
          <div className="h-3 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500/70 transition-all duration-700 ease-out"
              style={{ width: barsLive ? `${simplePct}%` : "0%" }}
            />
          </div>

          <div className="flex items-center justify-between text-sm sm:text-base font-bold pt-1">
            <span className={highlight ? "text-amber-200 login-weighted-label-glow" : "text-violet-200/90"}>
              고수강화예측
            </span>
            <span className={`tabular-nums font-black transition-colors duration-500 ${highlight ? "text-amber-300" : "text-violet-300"}`}>
              {weightedPct}%
            </span>
          </div>
          <div className="h-3.5 rounded-full bg-[#1a1a1a] overflow-hidden border border-amber-500/20">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                highlight ? "bg-gradient-to-r from-amber-500 to-violet-500 login-weighted-bar-pulse" : "bg-violet-500/75"
              }`}
              style={{ width: barsLive ? `${weightedPct}%` : "0%" }}
            />
          </div>
        </div>

        <p
          key={captionIdx}
          className="mt-3 text-center text-base sm:text-lg font-bold text-gray-400 login-weighted-caption-fade min-h-[1.5rem]"
        >
          {captions[captionIdx]}
        </p>
      </div>
    </div>
  );
}
