"use client";

import { useEffect, useState } from "react";

const DEMO_HOLDING = 100;

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

/** 예시 장면: 게이지·버튼·집단배율 가짜 숫자 (실제 참여·정산 무관, 반복 재생만) */
export default function SurveyConfidencePlayground() {
  const [gauge, setGauge] = useState(35);
  const [bob, setBob] = useState(0);
  const [btnGlow, setBtnGlow] = useState(0);
  const [crowdUpPct, setCrowdUpPct] = useState(42);
  /** 데모: 토큰으로 산 배율 부스트 배수 (루프 애니메이션, 고정값 아님) */
  const [itemBoostMult, setItemBoostMult] = useState(1.12);
  const [itemDemoPrice, setItemDemoPrice] = useState(120);

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

      const crowd = Math.round(42 + Math.sin((t + 0.35) * Math.PI * 2) * 18);
      setCrowdUpPct(Math.min(75, Math.max(25, crowd)));

      const boostPhase = (t + 0.18) % 1;
      const boostWave = Math.abs(Math.sin(boostPhase * Math.PI * 2));
      setItemBoostMult(Math.round((1.06 + boostWave * 0.28) * 100) / 100);
      setItemDemoPrice(Math.round(96 + boostWave * 164));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBtnGlow((i) => (i + 1) % 7);
    }, 550);
    return () => window.clearInterval(id);
  }, []);

  const isUp = gauge > 0;
  const abs = Math.abs(gauge);
  const bet = calcBet(gauge, DEMO_HOLDING);
  const halfSpanPct = (abs / 100) * 50;

  const crowdUpClamped = crowdUpPct;
  const crowdDnClamped = 100 - crowdUpPct;
  const crowdUpAdj = Math.max(5, crowdUpClamped);
  const crowdDnAdj = Math.max(5, crowdDnClamped);
  const rawMult = isUp ? crowdDnAdj / crowdUpAdj : crowdUpAdj / crowdDnAdj;
  const payoutMult = Math.round(rawMult * 1000) / 1000;

  const dirColor = isUp ? "text-red-400" : "text-blue-400";

  return (
    <div
      className="rounded-2xl border border-dashed border-amber-500/35 bg-[#141414]/80 overflow-hidden"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
        <span className="text-[10px] font-black text-amber-300 uppercase tracking-wide">예시 장면 반복 재생</span>
        <span className="text-[10px] text-gray-600">GIF처럼 루프 · 터치 불필요</span>
      </div>

      <div className="relative px-3 py-4 space-y-3">
        <div className="relative pt-5">
        {/* 포인터: 핸 따라 움직이는 예시 */}
        <div
          className="pointer-events-none absolute z-30 left-0 right-0 top-0 h-14 transition-all duration-100 ease-out"
        >
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
          <span className={`text-lg font-black tabular-nums ${dirColor}`}>{isUp ? "📈 상승 쪽 확신" : "📉 하락 쪽 확신"}</span>
          <span className={`text-xl font-black tabular-nums ${dirColor}`}>
            {isUp ? "+" : ""}
            {gauge}%
          </span>
        </div>

        <div className="relative h-8 w-full rounded-full bg-[#1A1A1A] border border-[#2A2A2A] overflow-visible mt-1">
          {isUp ? (
            <div className="absolute top-0 left-1/2 h-full bg-red-500 transition-all duration-100 ease-out" style={{ width: `${halfSpanPct}%` }} />
          ) : (
            <div
              className="absolute top-0 h-full bg-blue-500 transition-all duration-100 ease-out"
              style={{ right: "50%", width: `${halfSpanPct}%` }}
            />
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
        <p className="text-[10px] text-center text-gray-600">막대를 움직이면 숫자·색·거는 금액 같이 따라 변합니다.</p>

        {/* 버튼 순차 깜박 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1 justify-center opacity-95">
            {[
              ["올인", 0],
              ["-10", 1],
              ["-1", 2],
            ].map(([label, key]) => (
              <span key={key} className="inline-block">
                <span
                  className={`px-2 py-1.5 rounded-lg text-[9px] font-black border bg-[#111] transition-all duration-150 ${
                    btnGlow === key ? "border-cyan-400 scale-105 shadow-[0_0_12px_rgba(34,211,238,0.5)] text-cyan-200" : "border-blue-500/25 text-blue-400/80"
                  }`}
                >
                  {String(label)}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 justify-center opacity-95">
            {[
              ["+1", 3],
              ["+10", 4],
              ["올인", 5],
            ].map(([label, key]) => (
              <span key={key} className="inline-block">
                <span
                  className={`px-2 py-1.5 rounded-lg text-[9px] font-black border bg-[#111] transition-all duration-150 ${
                    btnGlow === key ? "border-pink-400 scale-105 shadow-[0_0_12px_rgba(251,113,133,0.45)] text-pink-200" : "border-red-500/25 text-red-400/80"
                  }`}
                >
                  {String(label)}
                </span>
              </span>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-center text-gray-600 -mt-1">실전에서도 같은 식으로 눌러 세밀하게 맞춥니다.</p>

        <div className="flex justify-between text-[11px] border border-[#2A2A2A] rounded-xl px-3 py-2.5 bg-[#111]/90">
          <span className="text-gray-500">예시 보유 💰</span>
          <span className="text-white font-bold tabular-nums">{DEMO_HOLDING.toLocaleString()}</span>
          <span className="text-gray-600 px-2">→</span>
          <span className="text-gray-500">거는 금액</span>
          <span className={`font-black tabular-nums ${dirColor}`}>{bet.toLocaleString()} 토큰</span>
        </div>

        {/* 집단 비율 + 배당 규모 시각 */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 text-center leading-tight">
            오늘 날 많은 사람이 찍은 쪽은 분모로 가까워져 배율은 내려가고 · 적게 찍힌 쪽은 거꾸로 커져요{" "}
            <span className="text-gray-600">(가짜 %로만 데모)</span>
          </p>
          <div className="flex h-3 rounded-full overflow-hidden border border-[#333] bg-[#0a0a0a]">
            <div
              className="bg-red-500/90 transition-all duration-200 ease-out flex items-center justify-center"
              style={{ width: `${crowdUpClamped}%` }}
            />
            <div
              className="bg-blue-500/90 transition-all duration-200 ease-out"
              style={{ width: `${crowdDnClamped}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 px-0.5">
            <span className="text-red-400/90">상승 예측 {crowdUpClamped}%</span>
            <span className="text-blue-400/90">하락 예측 {crowdDnClamped}%</span>
          </div>
        </div>

        {/* 적중 시 흐름 애니메이션 */}
        <div className="relative rounded-xl bg-[#0d0f12] border border-emerald-500/20 px-3 py-3 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none shimmer-demo-mask" />
          <p className="text-[10px] text-emerald-400 font-bold mb-3 text-center">적중이라면 받는 크기 줄기</p>
          <div className="w-full overflow-x-auto pb-px">
            <div className="grid min-w-[17.5rem] w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1 sm:gap-x-2 text-center [&>*]:min-w-0">
              <FlowChip
                label="거는 토큰"
                sub="확신·보유 기준"
                value={bet}
                accent="amber"
                emphasize
              />
              <FlowOp />
              <FlowChip
                label="집단배율"
                sub="많은 쪽 분모 작아짐"
                value={payoutMult}
                decimals={2}
                suffix="배"
                accent="cyan"
              />
              <FlowOp />
              <FlowChip
                label="배율 업 아이템"
                sub={"토큰으로 구매\n적중 시 곱함"}
                value={itemBoostMult}
                decimals={2}
                suffix="배"
                accent="violet"
                footnote={`예시 구매 ${itemDemoPrice.toLocaleString()} 토큰`}
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-3 leading-snug px-1">
            <span className="text-green-400/90">직전 서버 규칙과 같은 형태</span>입니다. 진짜 수치는 결과 반영 때 다시 따지고, 여긴 패턴만 보여 줍니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowChip({
  label,
  sub,
  value,
  decimals = 0,
  suffix = "",
  accent,
  emphasize,
  footnote,
}: {
  label: string;
  sub?: string;
  value: number;
  decimals?: number;
  suffix?: string;
  accent: "amber" | "cyan" | "violet";
  emphasize?: boolean;
  footnote?: string;
}) {
  const ring =
    accent === "amber"
      ? "border-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,.12)]"
      : accent === "cyan"
        ? "border-cyan-500/35 shadow-[0_0_20px_rgba(34,211,238,.15)] flow-pulse-soft"
        : "border-violet-500/35 shadow-[0_0_20px_rgba(139,92,246,.12)] flow-pulse-soft-delay";
  const v = decimals > 0 ? value.toFixed(decimals) : String(value);
  return (
    <div
      className={`h-full min-w-0 rounded-xl border px-2 py-2 bg-[#141414]/95 flex flex-col ${
        emphasize ? "scale-[1.02] border-amber-400/45 shadow-[0_0_16px_rgba(251,191,36,.15)]" : ring
      }`}
    >
      <div className="text-[9px] text-gray-500 font-bold leading-tight">{label}</div>
      <div className="text-[8px] text-gray-600 mt-0.5 leading-snug min-h-[2rem] whitespace-pre-line flex items-start justify-center">
        {sub ?? "\u00a0"}
      </div>
      <div className="text-lg font-black tabular-nums text-white mt-auto pt-1 tracking-tight shrink-0">
        {v}
        <span className="text-[10px] ml-px text-gray-500 font-bold">{suffix}</span>
      </div>
      {footnote ? (
        <div className="text-[7px] text-gray-600 mt-0.5 tabular-nums leading-tight min-h-[0.875rem]">{footnote}</div>
      ) : (
        <div className="mt-0.5 min-h-[0.875rem]" aria-hidden />
      )}
    </div>
  );
}

function FlowOp() {
  return (
    <div className="flow-op-x flex self-stretch items-center justify-center text-gray-600 font-black px-px select-none tabular-nums text-sm leading-none shrink-0">
      ×
    </div>
  );
}
