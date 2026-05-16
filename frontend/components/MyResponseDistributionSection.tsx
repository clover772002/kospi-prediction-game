"use client";

import type { DashboardData } from "@/lib/api";

type Hist = DashboardData["history"][number];

function duelFromItem(item: Hist): { up: number; down: number } {
  const g = item.gauge_position;
  if (typeof g === "number" && !Number.isNaN(g)) {
    const clamped = Math.max(-100, Math.min(100, g));
    const up = Math.round((clamped + 100) / 2);
    return { up, down: 100 - up };
  }
  return item.kospi_answer ? { up: 100, down: 0 } : { up: 0, down: 100 };
}

function convictionSamples(history: Hist[]): number[] {
  const out: number[] = [];
  for (const h of history) {
    const g = h.gauge_position;
    if (typeof g === "number" && !Number.isNaN(g)) {
      out.push(Math.abs(Math.max(-100, Math.min(100, g))));
    }
  }
  return out;
}

function boxPlotStats(values: number[]): { min: number; q1: number; med: number; q3: number; max: number } | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q = (p: number) => {
    if (n === 1) return s[0];
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo];
    return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
  };
  return {
    min: s[0]!,
    q1: q(0.25),
    med: q(0.5),
    q3: q(0.75),
    max: s[n - 1]!,
  };
}

function HorizontalConvictionBoxPlot({ stats }: { stats: { min: number; q1: number; med: number; q3: number; max: number } }) {
  const { min, q1, med, q3, max } = stats;
  const pad = (v: number) => Math.max(0, Math.min(100, v));

  return (
    <div className="w-full">
      <p className="text-[10px] text-gray-500 mb-2">확신도(게이지) 절댓값 분포 — 참여한 날만</p>
      <div className="relative h-16 w-full">
        <div className="absolute bottom-1 left-0 right-0 h-px bg-gray-700" />
        {/* 수염: min–max */}
        <div
          className="absolute bottom-2 h-4 w-px bg-gray-500"
          style={{ left: `${pad(min)}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute bottom-2 h-4 w-px bg-gray-500"
          style={{ left: `${pad(max)}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute bottom-3 h-0.5 bg-gray-600/80 rounded-full"
          style={{
            left: `${pad(min)}%`,
            width: `${Math.max(0, pad(max) - pad(min))}%`,
          }}
        />
        {/* IQR 상자 */}
        <div
          className="absolute bottom-3 h-6 rounded-md border border-cyan-400/40 bg-cyan-500/20"
          style={{
            left: `${pad(Math.min(q1, q3))}%`,
            width: `${Math.max(0.5, Math.abs(pad(q3) - pad(q1)))}%`,
          }}
        />
        {/* 중앙값 */}
        <div
          className="absolute bottom-2.5 w-0.5 h-7 bg-cyan-200 z-[1]"
          style={{ left: `${pad(med)}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 tabular-nums mt-1 px-0.5">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <p className="text-[9px] text-gray-600 mt-1.5 tabular-nums">
        min {min.toFixed(0)} · Q1 {q1.toFixed(0)} · 중앙 {med.toFixed(0)} · Q3 {q3.toFixed(0)} · max {max.toFixed(0)}
      </p>
    </div>
  );
}

/**
 * 내 설문 이력: 거래일별 상승/하락 쪽 비율(게이지 매핑) VS 대결 + 확신도 박스플롯
 */
export default function MyResponseDistributionSection({ history }: { history: Hist[] }) {
  if (history.length === 0) return null;

  const samples = convictionSamples(history);
  const stats = boxPlotStats(samples);

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-3 space-y-5">
      <div>
        <p className="font-bold text-sm text-white">내 예측 방향·확신도</p>
        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
          게이지가 있으면 그날 선택을 −100~+100으로 본 뒤, 상승 쪽·하락 쪽에 몇 퍼센트씩 실은 것처럼 보여 드려요. 게이지가 없던 날은 방향만 100%로 표시됩니다.
        </p>
      </div>

      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">거래일별 대결</p>
      </div>
      <div className="space-y-2 max-h-[min(420px,55vh)] overflow-y-auto pr-1">
        {history.map((item) => {
          const { up, down } = duelFromItem(item);
          const upWin = up >= down;
          return (
            <div
              key={item.date}
              className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 px-3 py-2.5"
            >
              <p className="text-[10px] text-gray-500 mb-2 tabular-nums">{item.date}</p>
              <div className="flex items-stretch gap-2 min-h-[72px]">
                <div
                  className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2 ${
                    upWin
                      ? "border-green-500/45 bg-gradient-to-b from-green-500/12 to-green-900/10"
                      : "border-green-700/25 bg-green-950/15"
                  }`}
                >
                  <span className="text-lg mb-0.5">📈</span>
                  <span className="text-[9px] font-black text-green-400/90 uppercase tracking-tighter">상승 쪽</span>
                  <span className="text-lg font-black text-green-400 tabular-nums leading-tight">
                    {up}
                    <span className="text-xs">%</span>
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                  <span className="text-sm font-black text-white/90 italic">VS</span>
                </div>
                <div
                  className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2 ${
                    !upWin
                      ? "border-red-500/45 bg-gradient-to-b from-red-500/12 to-red-900/10"
                      : "border-red-700/25 bg-red-950/15"
                  }`}
                >
                  <span className="text-lg mb-0.5">📉</span>
                  <span className="text-[9px] font-black text-red-400/90 uppercase tracking-tighter">하락 쪽</span>
                  <span className="text-lg font-black text-red-400 tabular-nums leading-tight">
                    {down}
                    <span className="text-xs">%</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-2">확신도 요약 (가로 박스플롯)</p>
        {stats && samples.length > 0 ? (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 px-3 py-3">
            <HorizontalConvictionBoxPlot stats={stats} />
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2">
            게이지(확신도)를 기록한 날이 없어 분포를 그리지 못했어요. 설문에서 슬라이더를 조정하면 여기에 쌓입니다.
          </p>
        )}
      </div>
    </div>
  );
}
