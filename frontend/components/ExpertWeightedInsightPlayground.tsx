"use client";

import { useEffect, useState } from "react";

const PHASE_MS = 720;
const N_PHASE = 6;

/** 둥둥 떠다니는 참가자 얼굴(단계마다 더 많이 등장) */
const CROWD_FACES: {
  x: string;
  y: string;
  d: number;
  showFrom: number;
  emoji: string;
  grad: string;
  floatSec: number;
}[] = [
  { x: "5%", y: "18%", d: 0, showFrom: 0, emoji: "😊", grad: "from-rose-500/90 to-rose-800/95", floatSec: 1.7 },
  { x: "18%", y: "32%", d: 60, showFrom: 0, emoji: "🙂", grad: "from-sky-500/90 to-sky-800/95", floatSec: 1.9 },
  { x: "32%", y: "12%", d: 120, showFrom: 1, emoji: "😄", grad: "from-violet-500/90 to-violet-800/95", floatSec: 2.1 },
  { x: "46%", y: "28%", d: 40, showFrom: 1, emoji: "🧑", grad: "from-amber-500/90 to-amber-800/95", floatSec: 1.65 },
  { x: "58%", y: "14%", d: 180, showFrom: 1, emoji: "👩", grad: "from-fuchsia-500/90 to-fuchsia-800/95", floatSec: 2.05 },
  { x: "70%", y: "30%", d: 90, showFrom: 2, emoji: "👨", grad: "from-emerald-500/90 to-emerald-800/95", floatSec: 1.85 },
  { x: "82%", y: "16%", d: 220, showFrom: 2, emoji: "😎", grad: "from-cyan-500/90 to-cyan-800/95", floatSec: 2.15 },
  { x: "12%", y: "48%", d: 150, showFrom: 2, emoji: "🙋", grad: "from-indigo-500/90 to-indigo-800/95", floatSec: 1.75 },
  { x: "38%", y: "44%", d: 260, showFrom: 3, emoji: "🧔", grad: "from-orange-500/90 to-orange-800/95", floatSec: 2.0 },
  { x: "54%", y: "50%", d: 300, showFrom: 3, emoji: "👱", grad: "from-lime-500/90 to-lime-800/95", floatSec: 1.95 },
  { x: "68%", y: "46%", d: 200, showFrom: 3, emoji: "🤓", grad: "from-pink-500/90 to-pink-800/95", floatSec: 2.25 },
  { x: "88%", y: "38%", d: 340, showFrom: 4, emoji: "👧", grad: "from-teal-500/90 to-teal-800/95", floatSec: 1.8 },
  { x: "24%", y: "8%", d: 380, showFrom: 4, emoji: "👴", grad: "from-yellow-500/90 to-yellow-800/95", floatSec: 2.3 },
  { x: "76%", y: "52%", d: 420, showFrom: 5, emoji: "👵", grad: "from-purple-500/90 to-purple-800/95", floatSec: 2.1 },
];

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

  const visibleFaces = CROWD_FACES.filter((f) => phase >= f.showFrom);
  const joinedCount = phase === 0 ? 0 : Math.min(128, 12 + visibleFaces.length * 9 + phase * 6);

  const captions = [
    "참가자가 모일수록 예측이 강해져요",
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

        {/* 참가자 얼굴 모이기 */}
        <div className="relative h-[5.75rem] mb-3 rounded-2xl border border-white/[0.06] bg-[#0a0a0c]/80 overflow-hidden">
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-2xl transition-all duration-700 ${
              votesIn ? "opacity-100" : "opacity-0"
            }`}
            style={{
              width: `${48 + visibleFaces.length * 10}px`,
              height: `${48 + visibleFaces.length * 10}px`,
            }}
            aria-hidden
          />
          {CROWD_FACES.map((face, i) => {
            const visible = phase >= face.showFrom;
            const size =
              phase >= 4 && i >= CROWD_FACES.length - 4
                ? "w-10 h-10 sm:w-11 sm:h-11 text-xl sm:text-2xl"
                : "w-9 h-9 sm:w-10 sm:h-10 text-lg sm:text-xl";
            return (
              <div
                key={i}
                className={`absolute flex items-center justify-center rounded-full border-2 border-white/20 shadow-lg bg-gradient-to-br transition-all duration-500 login-crowd-face ${size} ${face.grad} ${
                  visible ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
                style={{
                  left: face.x,
                  top: face.y,
                  transitionDelay: `${face.d}ms`,
                  animationDuration: `${face.floatSec}s`,
                  animationDelay: `${face.d * 0.35}ms`,
                }}
              >
                <span className="leading-none select-none" aria-hidden>
                  {face.emoji}
                </span>
              </div>
            );
          })}
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center pb-2 gap-0.5 transition-opacity duration-400 ${
              votesIn || phase === 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="text-xs sm:text-sm font-bold text-violet-300/90 tabular-nums">
              {phase === 0
                ? "참가자가 모이는 중…"
                : `${joinedCount}명 참여 · 집계가 강해지는 중`}
            </span>
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
