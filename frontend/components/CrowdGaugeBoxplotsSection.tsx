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
          border: "border-red-500/45",
          box: "border-red-400/50 bg-red-500/15",
          whisker: "bg-red-600/70",
          med: "bg-red-200",
          label: "text-red-400",
        }
      : {
          border: "border-blue-500/45",
          box: "border-blue-400/50 bg-blue-500/15",
          whisker: "bg-blue-600/70",
          med: "bg-blue-200",
          label: "text-blue-400",
        };

  const toPct = variant === "rise" ? riseToPercent : fallToPercent;

  if (isEmpty) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[#333] bg-[#101010]/80 px-2 py-2 text-sm text-white min-h-[80px] flex flex-col justify-center ${ring}`}
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
        <span className={`text-sm font-black uppercase tracking-tight leading-tight ${palette.label}`}>{subtitle}</span>
        <span className="text-sm text-white tabular-nums shrink-0">n={stats.n}</span>
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
        <div className="flex justify-between text-xs text-white/90 tabular-nums mt-1 px-0.5">
          <span>-100</span>
          <span>-50</span>
          <span>0</span>
        </div>
      ) : (
        <div className="flex justify-between text-xs text-white/90 tabular-nums mt-1 px-0.5">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      )}
      <p className="text-xs text-white/90 mt-0.5 tabular-nums leading-snug">
        min {min} · Q1 {q1} · 중앙 {median} · Q3 {q3} · max {max}
      </p>
    </div>
  );
}

function DirectionShareRibbon({
  pctRise,
  pctFall,
  nRise,
  nFall,
}: {
  pctRise: number;
  pctFall: number;
  nRise: number;
  nFall: number;
}) {
  const r = Number.isFinite(pctRise) ? Math.max(0, pctRise) : 0;
  const f = Number.isFinite(pctFall) ? Math.max(0, pctFall) : 0;

  return (
    <div className="rounded-xl border border-[#333] bg-gradient-to-br from-[#151515] to-[#101010] px-3 py-2.5 mb-3 ring-1 ring-white/[0.04]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-black text-red-400 tabular-nums tracking-tight">상승 {r}%</span>
          <span className="text-sm text-white tabular-nums">({nRise}명)</span>
        </div>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm text-white tabular-nums">({nFall}명)</span>
          <span className="text-sm font-black text-blue-400 tabular-nums tracking-tight">하락 {f}%</span>
        </div>
      </div>
      <div
        className="flex h-4 w-full rounded-lg overflow-hidden border border-[#2a2a2a] shadow-[inset_0_1px_3px_rgba(0,0,0,.4)]"
        title={`예측 상승 ${r}% · 하락 ${f}% (유효 응답 ${nRise + nFall}명)`}
      >
        {(r > 0 || nRise > 0) && (
          <div
            className="h-full min-w-[6px] bg-gradient-to-b from-red-400/95 via-red-500/90 to-red-800/80"
            style={{ flex: `${Math.max(r, 0.1)} 1 0%` }}
          />
        )}
        {(f > 0 || nFall > 0) && (
          <div
            className="h-full min-w-[6px] bg-gradient-to-b from-blue-400/95 via-blue-500/90 to-blue-800/85"
            style={{ flex: `${Math.max(f, 0.1)} 1 0%` }}
          />
        )}
      </div>
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

  const nRise = day.respondents_rise ?? day.rise?.n ?? 0;
  const nFall = day.respondents_fall ?? day.fall?.n ?? 0;
  const totalDir = nRise + nFall;
  const pctRise =
    typeof day.pct_rise === "number" && Number.isFinite(day.pct_rise)
      ? day.pct_rise
      : totalDir > 0
        ? Math.round((1000 * nRise) / totalDir) / 10
        : 0;
  const pctFall =
    typeof day.pct_fall === "number" && Number.isFinite(day.pct_fall)
      ? day.pct_fall
      : totalDir > 0
        ? Math.round((1000 * nFall) / totalDir) / 10
        : 0;

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-bold text-white tabular-nums">{day.survey_date}</p>
        <p
          className={`text-sm font-bold ${
            day.kospi_result === true
              ? "text-red-400"
              : day.kospi_result === false
                ? "text-blue-400"
                : "text-white"
          }`}
        >
          {resultLabel}
        </p>
      </div>

      <DirectionShareRibbon pctRise={pctRise} pctFall={pctFall} nRise={nRise} nFall={nFall} />

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
        <p className="font-bold text-base text-white">전체 예측 방향·확신도</p>
        <p className="text-sm text-white mt-2 leading-relaxed">
          거래일마다 숫자 줄로{" "}
          <strong className="text-red-400">상승</strong>
          ·
          <strong className="text-blue-400">하락</strong>
          선택 <strong className="text-white">비율(%)</strong>과 인원을 먼저 보여 주고,
          아래 두 막대는 각각 확신 게이지 분포예요.{" "}
          <strong className="text-white">하락</strong>은{" "}
          <strong className="text-white">−100~0</strong>(왼쪽), <strong className="text-white">상승</strong>은{" "}
          <strong className="text-white">0~100</strong>(오른쪽). 코스피 종가 방향 확정 후 맞은 쪽에{" "}
          <strong className="text-amber-200/90">골드 링</strong>입니다.
        </p>
      </div>

      {err ? (
        <p className="text-sm text-red-400 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">{err}</p>
      ) : null}

      {!err && days === null ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          <div className="h-20 rounded-xl bg-[#252525]" />
          <div className="h-20 rounded-xl bg-[#252525]" />
        </div>
      ) : null}

      {!err && days && days.length === 0 ? (
        <p className="text-base text-white">아직 집계할 거래일이 없어요.</p>
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
