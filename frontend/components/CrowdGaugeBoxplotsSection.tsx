"use client";

import { useEffect, useState } from "react";
import {
  getCrowdGaugeBoxplots,
  type CrowdGaugeBoxplotDay,
  type CrowdGaugeBoxplotStats,
} from "@/lib/api";

function HorizontalAbsBox({
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

  if (isEmpty) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[#333] bg-[#101010]/80 px-3 py-3 text-[10px] text-gray-500 ${ring}`}
      >
        <span className={palette.label}>{subtitle}</span>
        <p className="mt-1">이 날 해당 방향 선택 응답이 없거나 게이지를 쓸 수 없어요.</p>
      </div>
    );
  }

  const { min, q1, median, q3, max } = stats;
  const pad = (v: number) => Math.max(0, Math.min(100, v));

  return (
    <div className={`rounded-xl border ${palette.border} bg-[#141414]/90 px-3 py-2.5 ${ring}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-black uppercase tracking-tight ${palette.label}`}>{subtitle}</span>
        <span className="text-[10px] text-gray-500 tabular-nums">n={stats.n}</span>
      </div>
      <div className="relative h-14 w-full">
        <div className="absolute bottom-1 left-0 right-0 h-px bg-gray-700/90" />
        <div
          className={`absolute bottom-2 h-3.5 w-px ${palette.whisker}`}
          style={{ left: `${pad(min)}%`, transform: "translateX(-50%)" }}
        />
        <div
          className={`absolute bottom-2 h-3.5 w-px ${palette.whisker}`}
          style={{ left: `${pad(max)}%`, transform: "translateX(-50%)" }}
        />
        <div
          className={`absolute bottom-3 h-0.5 ${palette.whisker} rounded-full opacity-80`}
          style={{
            left: `${pad(min)}%`,
            width: `${Math.max(0, pad(max) - pad(min))}%`,
          }}
        />
        <div
          className={`absolute bottom-3 h-7 rounded-md border ${palette.box}`}
          style={{
            left: `${pad(Math.min(q1, q3))}%`,
            width: `${Math.max(0.35, Math.abs(pad(q3) - pad(q1)))}%`,
          }}
        />
        <div
          className={`absolute bottom-2.5 w-0.5 h-8 ${palette.med} z-[1]`}
          style={{ left: `${pad(median)}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 tabular-nums mt-1 px-0.5">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <p className="text-[9px] text-gray-600 mt-1 tabular-nums">
        min {min} · Q1 {q1} · 중앙 {median} · Q3 {q3} · max {max}
      </p>
    </div>
  );
}

function DayCard({ day }: { day: CrowdGaugeBoxplotDay }) {
  const resultLabel =
    day.kospi_result === true ? "코스피 상승" : day.kospi_result === false ? "코스피 하락" : "결과 미확정";

  const hiRise = day.correct_team === "rise";
  const hiFall = day.correct_team === "fall";

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-white tabular-nums">{day.survey_date}</p>
        <p className="text-[10px] text-gray-500">{resultLabel}</p>
      </div>
      <div className="space-y-3">
        <HorizontalAbsBox
          stats={day.rise}
          highlight={hiRise}
          variant="rise"
          subtitle="📈 상승 선택"
        />
        <HorizontalAbsBox
          stats={day.fall}
          highlight={hiFall}
          variant="fall"
          subtitle="📉 하락 선택"
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
          참여자 전체 기준으로, 거래일마다 <strong className="text-gray-400">상승 선택</strong>·<strong className="text-gray-400">하락 선택</strong> 무리의{" "}
          <strong className="text-gray-400">확신도 절댓값(0~100)</strong> 분포를 박스플롯으로 비교합니다. 사분위 박스·수염·중앙값(세로선). 코스피 결과가 확정된 날은 맞은 쪽에{" "}
          <strong className="text-amber-200/90">골드 링</strong> 하이라이트입니다.
        </p>
      </div>

      {err ? (
        <p className="text-xs text-red-400/90 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">{err}</p>
      ) : null}

      {!err && days === null ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-24 rounded-xl bg-[#252525]" />
          <div className="h-24 rounded-xl bg-[#252525]" />
        </div>
      ) : null}

      {!err && days && days.length === 0 ? (
        <p className="text-[11px] text-gray-500">아직 집계할 거래일이 없어요.</p>
      ) : null}

      {!err && days && days.length > 0 ? (
        <div className="space-y-3 max-h-[min(520px,60vh)] overflow-y-auto pr-1">{days.map((d) => (
          <DayCard key={d.survey_date} day={d} />
        ))}</div>
      ) : null}
    </div>
  );
}
