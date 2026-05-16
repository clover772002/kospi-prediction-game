"use client";

import { useEffect, useState } from "react";

const PHASE_MS = 580;
/** 8단계 루프: 잠금 → 안내 → 토큰 표시 → 지불 순간 → 해제 반짝 → 유지 ×2 → 다음 루프 */
const N_PHASE = 8;

/** 로그인 랜딩: 토큰으로 고수 선택픽 해제 카드 예시 */
export default function ExpertPickRevealPlayground() {
  const [phase, setPhase] = useState(0);
  const [burstNonce, setBurstNonce] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % N_PHASE);
    }, PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === 3) setBurstNonce((n) => n + 1);
  }, [phase]);

  const emphasizePrice = phase === 2 || phase === 3;
  const showBlur = phase < 5;
  const pickLive = phase >= 5 && phase <= 7;
  const ribbonActive = phase >= 4 && phase <= 7;

  return (
    <div className="w-full rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#1a1510]/95 to-[#101010] overflow-hidden expert-pick-card-glow">
      <div className="flex items-center justify-center px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
        <span className="text-[10px] font-black text-amber-200 tracking-wide">토큰 · 고수 선택픽</span>
      </div>

      <div className="relative px-3 py-4 min-h-[11.5rem]">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-violet-600/[0.06] transition-opacity duration-500 ${
            pickLive ? "opacity-100 expert-pick-aurora" : "opacity-40"
          }`}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col items-center text-center">
          <p className="text-[9px] text-gray-500 font-bold mb-2">오늘 코스피 · 고수 진영</p>

          <div className="relative w-full max-w-[15rem] mx-auto">
            {phase === 3 ? (
              <div
                key={burstNonce}
                className="absolute -top-1 left-1/2 z-20 expert-spend-burst text-amber-300 font-black text-lg tabular-nums pointer-events-none whitespace-nowrap"
              >
                −80<span className="text-sm ml-0.5">💰</span>
              </div>
            ) : null}

            <div
              className={`relative rounded-2xl border bg-[#0c0c0e]/90 px-3 py-4 transition-all duration-500 ${
                pickLive
                  ? "border-amber-400/45 shadow-[0_0_24px_rgba(251,191,36,.18)] scale-100"
                  : "border-white/[0.08] scale-[0.98]"
              }`}
            >
              <div
                className={`absolute inset-0 rounded-2xl transition-all duration-500 pointer-events-none ${
                  showBlur ? "backdrop-blur-[7px] bg-black/30" : "backdrop-blur-0 bg-transparent"
                }`}
              />

              <div
                className={`relative transition-all duration-500 ${showBlur ? "opacity-45 scale-[0.99]" : "opacity-100 scale-100"}`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`text-xl transition-transform duration-300 ${pickLive ? "scale-110" : ""}`}>
                    {pickLive ? "✨" : "🔒"}
                  </span>
                  <span className="text-[10px] font-black text-gray-400">
                    {pickLive ? "열람 완료" : "열람 전 · 토큰 필요"}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-black text-white">KOSPI 방향</p>
                  <p className="text-[10px] text-gray-600">누적 적중률 높은 고수들의 오늘 선택</p>
                </div>

                <div
                  className={`mt-3 rounded-xl border px-3 py-3 transition-all duration-500 ${
                    pickLive
                      ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-600/10 expert-pick-reveal-sheen"
                      : "border-[#2a2a2e] bg-[#111]/80"
                  }`}
                >
                  <p className="text-[9px] text-gray-500 font-bold mb-1">고수 선택픽</p>
                  <p
                    className={`text-2xl font-black tracking-tight transition-all duration-500 ${
                      pickLive
                        ? "bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300 bg-clip-text text-transparent expert-pick-title-glow"
                        : "text-gray-700"
                    }`}
                  >
                    {pickLive ? "📈 상승" : "••••"}
                  </p>
                  {pickLive ? (
                    <p className="text-[9px] text-amber-200/80 font-bold mt-1">실제 앱에선 코인·날짜마다 달라져요</p>
                  ) : (
                    <p className="text-[9px] text-gray-600 mt-1">토큰으로 해제하면 표시</p>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`mt-3 flex flex-wrap items-center justify-center gap-2 transition-all duration-300 ${
                emphasizePrice ? "scale-105" : "scale-100"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black tabular-nums transition-all duration-300 ${
                  emphasizePrice
                    ? "border-amber-400/60 bg-amber-500/20 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,.25)] expert-pick-price-tag"
                    : "border-white/10 bg-[#1a1a1a] text-gray-400"
                }`}
              >
                <span className="text-yellow-400/90">💰</span>
                해제 비용 예시 · 80
              </span>
              {ribbonActive ? (
                <span className="text-[9px] font-black text-emerald-400/90 expert-pick-ribbon">적중 분배 재미에 쓰이는 재화</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
