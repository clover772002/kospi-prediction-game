"use client";

import { useEffect, useState } from "react";

const DEMO_HOLDING = 100;

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

function crowdMultiplier(gauge: number, yesPct: number) {
  const crowdUp = Math.max(5, yesPct);
  const crowdDn = Math.max(5, 100 - yesPct);
  return gauge > 0 ? Math.round((crowdDn / crowdUp) * 1000) / 1000 : Math.round((crowdUp / crowdDn) * 1000) / 1000;
}

/** 설문 카드 안 예시 블록(데모 숫자, 실제 참여·정산과 무관) */
export default function SurveyConfidencePlayground() {
  const [gauge, setGauge] = useState(35);
  const [bob, setBob] = useState(0);
  const DEMO_YES_PCT = 42;

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const duration = 6000;

    const tick = (now: number) => {
      const t = ((now - start) % duration) / duration;
      const sine = Math.sin(t * Math.PI * 2);
      let raw = Math.round(sine * 74);
      if (raw === 0) raw = sine >= 0 ? 12 : -12;
      raw = Math.max(-95, Math.min(95, raw));
      setGauge(raw);
      setBob(Math.sin(now / 220) * 4);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isUp = gauge > 0;
  const abs = Math.abs(gauge);
  const bet = calcBet(gauge, DEMO_HOLDING);
  const halfSpanPct = (abs / 100) * 50;
  const mult = crowdMultiplier(gauge, DEMO_YES_PCT);
  const grossHit = Math.max(1, Math.round(bet * mult));

  const riseVisual = Math.round(12 + (isUp ? (abs / 100) * 88 : (100 - abs) / 100 * 20));
  const fallVisual = Math.round(12 + (!isUp ? (abs / 100) * 88 : (100 - abs) / 100 * 20));

  const dirColor = isUp ? "text-red-400" : "text-blue-400";

  return (
    <div className="rounded-2xl border border-dashed border-amber-500/35 bg-[#141414]/80 overflow-hidden" aria-hidden>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
        <span className="text-[13px] font-black text-amber-200 w-8 text-center">예시</span>
      </div>

      <div className="relative px-3 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-red-500/25 bg-[#0d0d0d] px-2 py-2 flex flex-col items-center min-h-[7rem]">
            <span className="text-[10px] font-black text-red-400 mb-2">상승</span>
            <div className="flex-1 w-full flex items-end justify-center min-h-[4.25rem] rounded-lg bg-[#111] border border-[#2a2a2a] overflow-hidden px-2 pb-1">
              <div
                className="w-full rounded-md bg-red-500/85 transition-all duration-100 ease-out"
                style={{ height: `${riseVisual}%`, minHeight: "6px" }}
              />
            </div>
          </div>
          <div className="rounded-xl border border-blue-500/25 bg-[#0d0d0d] px-2 py-2 flex flex-col items-center min-h-[7rem]">
            <span className="text-[10px] font-black text-blue-400 mb-2">하락</span>
            <div className="flex-1 w-full flex items-end justify-center min-h-[4.25rem] rounded-lg bg-[#111] border border-[#2a2a2a] overflow-hidden px-2 pb-1">
              <div
                className="w-full rounded-md bg-blue-500/85 transition-all duration-100 ease-out"
                style={{ height: `${fallVisual}%`, minHeight: "6px" }}
              />
            </div>
          </div>
        </div>
        <div className="relative pt-5">
          <div className="pointer-events-none absolute z-30 left-0 right-0 top-0 h-14 transition-all duration-100 ease-out">
            <div
              className="absolute text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]"
              style={{
                left: `calc(${50 + gauge / 2}%)`,
                top: `${2 + bob}px`,
                transform: "translateX(-50%)",
              }}
            >
              👆
            </div>
          </div>

          <div className="flex justify-between items-baseline px-0.5">
            <span className={`text-sm font-black tabular-nums ${dirColor}`}>{isUp ? "상승 확신 쪽" : "하락 확신 쪽"}</span>
            <span className={`text-lg font-black tabular-nums ${dirColor}`}>
              {isUp ? "+" : ""}
              {gauge}%
            </span>
          </div>

          <div className="relative h-8 w-full rounded-full bg-[#1A1A1A] border border-[#2A2A2A] overflow-visible mt-1">
            {isUp ? (
              <div className="absolute top-0 left-1/2 h-full bg-red-500 transition-all duration-100 ease-out" style={{ width: `${halfSpanPct}%` }} />
            ) : (
              <div className="absolute top-0 h-full bg-blue-500 transition-all duration-100 ease-out" style={{ right: "50%", width: `${halfSpanPct}%` }} />
            )}
            <div className="absolute left-1/2 top-0 z-10 h-full w-0.5 bg-[#333] -translate-x-1/2" />
            <div
              className={`absolute top-1/2 z-10 -translate-y-1/2 w-5 h-5 rounded-full border-2 shadow-lg transition-all duration-100 ease-out ${
                isUp ? "bg-red-400 border-red-300" : "bg-blue-400 border-blue-300"
              }`}
              style={{
                left: `calc(${50 + gauge / 2}% - 10px)`,
              }}
            />
          </div>
        </div>

        <div className="flex justify-between text-[11px] border border-[#2A2A2A] rounded-xl px-3 py-2 bg-[#111]/90">
          <span className="text-gray-500 shrink-0">보유</span>
          <span className="text-white font-bold tabular-nums">{DEMO_HOLDING.toLocaleString()}</span>
          <span className="text-gray-600 px-1">→</span>
          <span className="text-gray-500 shrink-0">배팅</span>
          <span className={`font-black tabular-nums shrink-0 ${dirColor}`}>{bet.toLocaleString()}</span>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-[#0d1210]/90 px-2 py-2 space-y-1">
          <p className="text-[9px] text-emerald-400/95 font-bold text-center">적중 시 (예시 숫자)</p>
          <p className="text-[11px] text-center tabular-nums text-white leading-relaxed">
            <span className="text-gray-400 font-bold">{bet.toLocaleString()}</span>
            <span className="text-gray-600 mx-0.5">×</span>
            <span className="text-cyan-300/95 font-black">{mult.toFixed(2)}</span>
            <span className="text-[9px] text-gray-500 ml-1">집단배율</span>
            <span className="text-gray-600 mx-1">≈</span>
            <span className="text-emerald-300 font-black">+{grossHit}</span>
            <span className="text-[9px] text-gray-500">토큰</span>
          </p>
          <p className="text-[8px] text-gray-600 text-center">실패 시 배팅 토큰만큼 차감되는 흐름이에요</p>
        </div>
      </div>
    </div>
  );
}
