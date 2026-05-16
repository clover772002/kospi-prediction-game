"use client";

import { useEffect, useState } from "react";
import {
  getCrowdGaugeBoxplots,
  type CrowdGaugeBoxplotDay,
  type CrowdGaugeBoxplotStats,
} from "@/lib/api";

/** 하락축 -100~0 → 플롯 0~100% (왼쪽이 -100, 오른쪽이 0) */
function fallToPercent(v: number): number {
  const c = Math.max(-100, Math.min(0, v));
  return c + 100;
}

/** 상승축 0~100 → 플롯 0~100% */
function riseToPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function HorizontalSignedBox({
  stats,
  highlight,
  variant,
  subtitle,
}: {
  stats: CrowdGaugeBoxplotStats | null;
  highlight: boolean;
  variant: "rise" | "fall";
  subtitle: string;
}) {
  const isEmpty = !stats || stats.n === 0;
  const ring = highlight ? "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-[#1A1A1A] shadow-[0_0_20px_rgba(251,191,36,0.15)]" : "";

  const palette =
    variant === "rise"
      ? {
          border: "border-green-500/45",
          box: "border-green-400/50 bg-green-500/15",
          whisker: "bg-green-600/70",
          med: "bg-green-200",
          label: "text-green-400",
        }
      : {
          border: "border-red-500/45",
          box: "border-red-400/50 bg-red-500/15",
          whisker: "bg-red-600/70",
          med: "bg-red-200",
          label: "text-red-400",
        };

  const toPct = variant === "rise" ? riseToPercent : fallToPercent;

  if (isEmpty) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[#333] bg-[#101010]/80 px-2 py-2 text-[10px] text-gray-500 min-h-[80px] flex flex-col justify-center ${ring}`}
      >
        <span className={palette.label}>{subtitle}</span>
        <p className="mt-1 leading-snug">이 날 해당 방향 응답이 없어요.</p>
      </div>
    );
  }

  const { min, q1, median, q3, max } = stats;
  const pMin = toPct(min);
  const pMax = toPct(max);
  const pQ1 = toPct(q1);
  const pQ3 = toPct(q3);
  const pMed = toPct(median);
  const boxLeft = Math.min(pQ1, pQ3);
  const boxW = Math.max(0.35, Math.abs(pQ3 - pQ1));

  return (
    <div className={`rounded-xl border ${palette.border} bg-[#141414]/90 px-2 py-2 min-h-[80px] flex flex-col ${ring}`}>
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-[9px] font-black uppercase tracking-tight leading-tight ${palette.label}`}>{subtitle}</span>
        <span className="text-[9px] text-gray-500 tabular-nums shrink-0">n={stats.n}</span>
      </div>
      <div className="relative h-8 w-full flex-1 min-h-[32px]">
        <div className="absolute bottom-0.5 left-0 right-0 h-px bg-gray-700/90" />
        <div
          className={`absolute bottom-1.5 h-2 w-px ${palette.whisker}`}
          style={{ left: `${pMin}%`, transform: "translateX(-50%)" }}
        />
        <div
          className={`absolute bottom-1.5 h-2 w-px ${palette.whisker}`}
          style={{ left: `${pMax}%`, transform: "translateX(-50%)" }}
        />
        <div
          className={`absolute bottom-2 h-0.5 ${palette.whisker} rounded-full opacity-80`}
          style={{
            left: `${Math.min(pMin, pMax)}%`,
            width: `${Math.abs(pMax - pMin)}%`,
          }}
        />
        <div
          className={`absolute bottom-2 h-4 rounded-md border ${palette.box}`}
          style={{
            left: `${boxLeft}%`,
            width: `${boxW}%`,
          }}
        />
        <div
          className={`absolute bottom-1.5 w-0.5 h-5 ${palette.med} z-[1]`}
          style={{ left: `${pMed}%`, transform: "translateX(-50%)" }}
        />
      </div>
      {variant === "fall" ? (
        <div className="flex justify-between text-[8px] text-gray-600 tabular-nums mt-1 px-0.5">
          <span>-100</span>
          <span>-50</span>
          <span>0</span>
        </div>
      ) : (
        <div className="flex justify-between text-[8px] text-gray-600 tabular-nums mt-1 px-0.5">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      )}
      <p className="text-[8px] text-gray-600 mt-0.5 tabular-nums leading-snug">
        min {min} · Q1 {q1} · 중앙 {median} · Q3 {q3} · max {max}
      </p>
    </div>
  );
}

function DayCard({ day }: { day: CrowdGaugeBoxplotDay }) {
  const resultLabel =
    day.kospi_result === true
      ? "장 마감 상승"
      : day.kospi_result === false
        ? "장 마감 하락"
        : "결과 미확정";

  const hiRise = day.correct_team === "rise";
  const hiFall = day.correct_team === "fall";

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-white tabular-nums">{day.survey_date}</p>
        <p
          className={`text-[10px] font-bold ${
            day.kospi_result === true
              ? "text-green-400"
              : day.kospi_result === false
                ? "text-red-400"
                : "text-gray-500"
          }`}
        >
          {resultLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <HorizontalSignedBox
          stats={day.fall}
          highlight={hiFall}
          variant="fall"
          subtitle="📉 하락 선택 (−100~0)"
        />
        <HorizontalSignedBox
          stats={day.rise}
          highlight={hiRise}
          variant="rise"
          subtitle="📈 상승 선택 (0~100)"
        />
      </div>
    </div>
  );
}

export default function CrowdGaugeBoxplotsSection() {
  const [days, setDays] = useState<CrowdGaugeBoxplotDay[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    void (async () => {
      try {
        const d = await getCrowdGaugeBoxplots(30);
        if (!cancelled) setDays(d.days);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-3 space-y-4">
      <div>
        <p className="font-bold text-sm text-white">전체 예측 방향·확신도</p>
        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
          거래일마다 <strong className="text-gray-400">하락 선택</strong>은 게이지{" "}
          <strong className="text-gray-400">−100~0</strong>(왼쪽 막대), <strong className="text-gray-400">상승 선택</strong>은{" "}
          <strong className="text-gray-400">0~100</strong>(오른쪽 막대)으로 나란히 표시합니다. 코스피 종가 방향이 정해지면 맞은 쪽에{" "}
          <strong className="text-amber-200/90">골드 링</strong>이 붙습니다. 오른쪽 위가{" "}
          <strong className="text-gray-400">결과 미확정</strong>이면 아직 그날 코스피 종가 방향이 서버 DB에 입력되지 않은 거예요.
        </p>
      </div>

      {err ? (
        <p className="text-xs text-red-400/90 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">{err}</p>
      ) : null}

      {!err && days === null ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          <div className="h-20 rounded-xl bg-[#252525]" />
          <div className="h-20 rounded-xl bg-[#252525]" />
        </div>
      ) : null}

      {!err && days && days.length === 0 ? (
        <p className="text-[11px] text-gray-500">아직 집계할 거래일이 없어요.</p>
      ) : null}

      {!err && days && days.length > 0 ? (
        <div className="space-y-3 max-h-[min(520px,60vh)] overflow-y-auto pr-1">
          {days.map((d) => (
            <DayCard key={d.survey_date} day={d} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
