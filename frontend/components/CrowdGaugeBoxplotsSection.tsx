"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getCrowdGaugeBoxplots,
  type CrowdGaugeBoxplotDay,
  type CrowdGaugeBoxplotStats,
} from "@/lib/api";
import { KospiLiveQuote, type KospiLiveQuoteData } from "@/components/KospiPriceStrip";
import { surveyUi } from "@/lib/survey-ui-tokens";

/** 하락축 -100~0 → 플롯 0~100% (왼쪽이 -100, 오른쪽이 0) */
function fallToPercent(v: number): number {
  const c = Math.max(-100, Math.min(0, v));
  return c + 100;
}

/** 상승축 0~100 → 플롯 0~100% */
function riseToPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function formatKospiChangePctText(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const n = Number(pct);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatMarketResultLabel(
  kospiResult: boolean | null,
  kospiChangePct: number | null | undefined,
): string {
  const base =
    kospiResult === true
      ? "장 마감 상승"
      : kospiResult === false
        ? "장 마감 하락"
        : "결과 미확정";
  const pctText = formatKospiChangePctText(kospiChangePct);
  return pctText ? `${base} (${pctText})` : base;
}

function BoxplotCardWrap({ highlight, children }: { highlight: boolean; children: ReactNode }) {
  return (
    <div className="relative h-full min-w-0">
      {highlight ? (
        <span className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-xs font-black text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
          정답
        </span>
      ) : null}
      {children}
    </div>
  );
}

function BoxplotColumnHeader({
  variant,
  count,
  emphasize,
}: {
  variant: "rise" | "fall";
  count: number;
  emphasize: boolean;
}) {
  const label = variant === "fall" ? "하락선택" : "상승선택";
  const color = variant === "fall" ? "text-blue-400" : "text-red-400";
  const rowCls = emphasize ? `${surveyUi.body} mb-0.5` : "text-sm font-black mb-0.5";

  return (
    <div className={`flex items-center justify-center gap-1.5 ${rowCls}`}>
      <span className={color}>{label}</span>
      <span className={`tabular-nums ${emphasize ? surveyUi.label : "text-white/85"}`}>n={count}</span>
    </div>
  );
}

function HorizontalSignedBox({
  stats,
  highlight,
  variant,
  respondentCount,
  emphasize = false,
}: {
  stats: CrowdGaugeBoxplotStats | null;
  highlight: boolean;
  variant: "rise" | "fall";
  respondentCount: number;
  emphasize?: boolean;
}) {
  const isEmpty = !stats || stats.n === 0;
  const ring = highlight
    ? "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-[#1A1A1A] shadow-[0_0_20px_rgba(251,191,36,0.15)]"
    : "";

  const palette =
    variant === "rise"
      ? {
          border: "border-red-500/45",
          box: "border-red-400/50 bg-red-500/15",
          whisker: "bg-red-600/70",
          med: "bg-red-200",
        }
      : {
          border: "border-blue-500/45",
          box: "border-blue-400/50 bg-blue-500/15",
          whisker: "bg-blue-600/70",
          med: "bg-blue-200",
        };

  const toPct = variant === "rise" ? riseToPercent : fallToPercent;
  const cardPad = emphasize ? "px-2.5 py-2" : "px-2 py-1.5";

  const filledShellCls = emphasize
    ? "rounded-xl border-0 bg-[#181818]/70"
    : `rounded-xl border ${palette.border} bg-[#141414]/90`;
  const emptyShellCls = emphasize
    ? "rounded-xl border border-dashed border-[#333]/60 bg-[#101010]/50"
    : "rounded-xl border border-dashed border-[#333] bg-[#101010]/80";

  if (isEmpty) {
    return (
      <BoxplotCardWrap highlight={highlight}>
        <div className={`${emptyShellCls} ${cardPad} flex flex-col ${ring}`}>
          <BoxplotColumnHeader variant={variant} count={respondentCount} emphasize={emphasize} />
          <p className="text-[10px] sm:text-xs text-center text-white/70 leading-tight py-3 min-h-[3.5rem] flex flex-col items-center justify-center gap-0.5">
            <span>해당방향</span>
            <span>응답없음</span>
          </p>
        </div>
      </BoxplotCardWrap>
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
  const whiskerStroke = variant === "rise" ? "#dc2626" : "#2563eb";
  const boxFill = variant === "rise" ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)";
  const boxStroke = variant === "rise" ? "rgba(248,113,113,0.55)" : "rgba(96,165,250,0.55)";
  const midY = 10;
  const boxTop = 3;
  const boxBottom = 17;

  return (
    <BoxplotCardWrap highlight={highlight}>
      <div className={`${filledShellCls} ${cardPad} flex flex-col h-full ${ring}`}>
        <BoxplotColumnHeader variant={variant} count={respondentCount} emphasize={emphasize} />
        <div className="relative w-full mt-1">
          <svg
            viewBox="0 0 100 20"
            className="block w-full h-5"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1={pMin}
              y1={midY}
              x2={pMax}
              y2={midY}
              stroke={whiskerStroke}
              strokeWidth="0.65"
              strokeLinecap="round"
              opacity={0.85}
            />
            <line
              x1={pMin}
              y1={midY - 3.5}
              x2={pMin}
              y2={midY + 3.5}
              stroke={whiskerStroke}
              strokeWidth="0.65"
              strokeLinecap="round"
            />
            <line
              x1={pMax}
              y1={midY - 3.5}
              x2={pMax}
              y2={midY + 3.5}
              stroke={whiskerStroke}
              strokeWidth="0.65"
              strokeLinecap="round"
            />
            <rect
              x={boxLeft}
              y={boxTop}
              width={boxW}
              height={boxBottom - boxTop}
              rx={1.2}
              fill={boxFill}
              stroke={boxStroke}
              strokeWidth="0.5"
            />
            <line
              x1={pMed}
              y1={boxTop}
              x2={pMed}
              y2={boxBottom}
              stroke="#f5f5f5"
              strokeWidth="0.75"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-1 h-px w-full bg-gray-700/90" />
        </div>
        {variant === "fall" ? (
          <div className="flex justify-between text-[10px] sm:text-xs text-white/80 tabular-nums mt-1 px-0.5">
            <span>-100</span>
            <span>-50</span>
            <span>0</span>
          </div>
        ) : (
          <div className="flex justify-between text-[10px] sm:text-xs text-white/80 tabular-nums mt-1 px-0.5">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        )}
      </div>
    </BoxplotCardWrap>
  );
}

/** 0%여도 도넛에 반대 색을 아주 얇게 표시 (12시=상승 빨강 → 시계방향 하락 파랑) */
const PIE_MIN_ZERO_PCT = 3;

function directionPieBackground(pctFall: number, pctRise: number): string {
  const f = Math.min(100, Math.max(0, pctFall));
  const r = Math.min(100, Math.max(0, pctRise));
  if (f <= 0 && r <= 0) return "#2a2a2a";

  let visR = r;
  let visF = f;
  if (r > 0 && f <= 0) {
    visR = 100 - PIE_MIN_ZERO_PCT;
    visF = PIE_MIN_ZERO_PCT;
  } else if (f > 0 && r <= 0) {
    visF = 100 - PIE_MIN_ZERO_PCT;
    visR = PIE_MIN_ZERO_PCT;
  }

  const riseDeg = (visR / 100) * 360;
  return `conic-gradient(from -90deg, #ef4444 0deg ${riseDeg}deg, #3b82f6 ${riseDeg}deg 360deg)`;
}

/** 방향 비율 — 도넛 파이(12시부터 상승=빨강 → 하락=파랑) */
function DirectionSharePie({
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
  const total = nRise + nFall;

  if (total <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#333] bg-[#101010]/90 px-3 py-4 mb-3 text-center">
        <p className="text-sm text-gray-500">방향 응답이 아직 없어요</p>
      </div>
    );
  }

  const pieBg = directionPieBackground(f, r);
  const dominant =
    r > f ? { label: "상승", pct: r } : r < f ? { label: "하락", pct: f } : { label: "동률", pct: 50 };

  return (
    <div
      className="rounded-xl bg-gradient-to-br from-[#151515]/90 to-[#101010]/90 px-3 py-2.5 mb-3"
      title={`예측 상승 ${r}% · 하락 ${f}%`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span className="text-sm font-black text-red-400 tabular-nums">상승 {r}%</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
            <span className="text-sm font-black text-blue-400 tabular-nums">하락 {f}%</span>
          </div>
        </div>

        <div className="relative h-[4.75rem] w-[4.75rem] sm:h-20 sm:w-20 shrink-0">
          <div
            className="h-full w-full rounded-full border border-[#2a2a2a] shadow-[inset_0_2px_8px_rgba(0,0,0,.45)]"
            style={{ background: pieBg }}
            aria-hidden
          />
          <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-[#0d0d0d] border border-[#2a2a2a] text-center leading-tight shadow-[0_0_0_2px_#0d0d0d]">
            <span className="text-xs sm:text-sm font-black text-white">{dominant.label}</span>
            <span className="text-sm sm:text-base font-black text-white tabular-nums">{dominant.pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayCard({
  day,
  emphasize = false,
  liveKospi = null,
}: {
  day: CrowdGaugeBoxplotDay;
  emphasize?: boolean;
  liveKospi?: KospiLiveQuoteData | null;
}) {
  const resultLabel = formatMarketResultLabel(day.kospi_result, day.kospi_change_pct);
  const pendingResult = isPendingResult(day);

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

  const dateCls = emphasize ? `${surveyUi.body} text-white` : "text-sm font-bold text-white tabular-nums";
  const resultCls = emphasize
    ? `${surveyUi.body} ${
        day.kospi_result === true
          ? "text-red-400"
          : day.kospi_result === false
            ? "text-blue-400"
            : "text-amber-200"
      }`
    : `text-sm font-bold ${
        day.kospi_result === true
          ? "text-red-400"
          : day.kospi_result === false
            ? "text-blue-400"
            : "text-white"
      }`;
  return (
    <div
      className={
        emphasize
          ? "px-1 pb-1 pt-0"
          : "rounded-xl border border-[#2A2A2A] bg-[#141414]/80 px-3 py-2.5"
      }
    >
      {emphasize ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2 px-1">
          <p className={resultCls}>{pendingResult ? "결과 미확정" : resultLabel}</p>
          {pendingResult && liveKospi?.price != null ? <KospiLiveQuote live={liveKospi} /> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <p className={`${dateCls} tabular-nums`}>{day.survey_date}</p>
          <p className={resultCls}>{resultLabel}</p>
        </div>
      )}
      <DirectionSharePie pctRise={pctRise} pctFall={pctFall} nRise={nRise} nFall={nFall} />

      <div className="grid grid-cols-2 items-stretch gap-x-2 sm:gap-x-3">
        <HorizontalSignedBox
          stats={day.rise}
          highlight={hiRise}
          variant="rise"
          respondentCount={nRise}
          emphasize={emphasize}
        />
        <HorizontalSignedBox
          stats={day.fall}
          highlight={hiFall}
          variant="fall"
          respondentCount={nFall}
          emphasize={emphasize}
        />
      </div>
    </div>
  );
}

function normalizeSurveyDateKey(d: string | null | undefined): string {
  return (d ?? "").trim().slice(0, 10);
}

/** 실시간 집계 헤더용 — 연도 없이 MM.DD */
function formatLiveDateLabel(dateKey: string): string {
  const parts = dateKey.trim().slice(0, 10).split("-");
  if (parts.length >= 3) return `${parts[1]}.${parts[2]}`;
  return dateKey.replace(/-/g, ".");
}

function isPendingResult(day: CrowdGaugeBoxplotDay): boolean {
  return day.kospi_result === null || day.kospi_result === undefined;
}

type SectionProps = {
  /** 설문 탭: 진행 중 설문만 · 대시보드: 전체 목록 */
  variant?: "dashboard" | "survey";
  /** 설문 탭: 지금 투표·대기 중인 거래일 (YYYY-MM-DD) */
  openDates?: string[];
  /** 설문 실시간 집계 — 결과 미확정 옆 장중 시세 */
  liveKospi?: KospiLiveQuoteData | null;
  /** 설문 탭: 상단·사전예측 풋 공유 (중복 fetch 방지) */
  days?: CrowdGaugeBoxplotDay[] | null;
  daysError?: string | null;
};

export default function CrowdGaugeBoxplotsSection({
  variant = "dashboard",
  openDates = [],
  liveKospi = null,
  days: daysProp,
  daysError: daysErrorProp,
}: SectionProps) {
  const [internalDays, setInternalDays] = useState<CrowdGaugeBoxplotDay[] | null>(null);
  const [internalErr, setInternalErr] = useState<string | null>(null);
  const isSurvey = variant === "survey";
  const controlled = daysProp !== undefined;
  const days = controlled ? daysProp : internalDays;
  const err = controlled ? (daysErrorProp ?? null) : internalErr;
  const openKeys = openDates.map(normalizeSurveyDateKey).filter((k) => k.length >= 8);

  useEffect(() => {
    if (controlled) return;
    let cancelled = false;
    setInternalErr(null);
    void (async () => {
      try {
        const d = await getCrowdGaugeBoxplots(isSurvey ? 8 : 30);
        if (!cancelled) setInternalDays(Array.isArray(d.days) ? d.days : []);
      } catch (e: unknown) {
        if (!cancelled) setInternalErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSurvey, controlled]);

  const pendingByKey = new Map(
    (days ?? []).filter(isPendingResult).map((d) => [normalizeSurveyDateKey(d.survey_date), d] as const),
  );
  const liveEntries = openKeys
    .map((key) => ({
      key,
      day: pendingByKey.get(key) ?? null,
    }))
    .filter((e) => e.day !== null);

  const shellClass = isSurvey
    ? "fade-up-3 space-y-3"
    : "bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-3 space-y-4";

  return (
    <div className={shellClass}>
      {!isSurvey ? (
        <p className="font-bold text-base text-white">전체 예측 방향/확신분포</p>
      ) : null}

      {err ? (
        <p className="text-sm text-red-400 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
          {err}
        </p>
      ) : null}

      {!err && days === null ? (
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          <div className="h-28 rounded-xl bg-[#252525]" />
          <div className="h-28 rounded-xl bg-[#252525]" />
        </div>
      ) : null}

      {!err && days && days.length === 0 && (!isSurvey || openKeys.length === 0) ? (
        <p className={isSurvey ? surveyUi.bodyMuted : "text-base text-white"}>
          아직 집계할 거래일이 없어요.
        </p>
      ) : null}

      {isSurvey && !err && days !== null && openKeys.length === 0 ? (
        <p className={surveyUi.bodyMuted}>지금 집계할 진행 중 설문이 없어요.</p>
      ) : null}

      {isSurvey && !err && days !== null && liveEntries.length > 0 ? (
        <div className="space-y-4">
          {liveEntries.map(({ key, day }) => (
            <div key={key} className="rounded-xl bg-violet-950/10 px-2 py-2 sm:px-3">
              <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
                <p className={`${surveyUi.body} text-violet-100 tabular-nums`}>
                  {formatLiveDateLabel(key)} · {day ? "진행 중 · 실시간 집계" : "진행 중 · 응답 대기"}
                </p>
              </div>
              <DayCard day={day!} emphasize liveKospi={liveKospi} />
            </div>
          ))}
        </div>
      ) : null}

      {!isSurvey && !err && days && days.length > 0 ? (
        <div className="space-y-3 max-h-[min(520px,60vh)] overflow-y-auto pr-1">
          {days.map((d) => (
            <DayCard key={d.survey_date} day={d} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 사전 예측 제출 아래 — 해당 거래일 무리 집계(응답 없으면 안내) */
export function SurveyDayCrowdFoot({
  dateKey,
  days,
  daysError,
  liveKospi = null,
}: {
  dateKey: string;
  days: CrowdGaugeBoxplotDay[] | null;
  daysError: string | null;
  liveKospi?: KospiLiveQuoteData | null;
}) {
  const key = normalizeSurveyDateKey(dateKey);
  if (key.length < 8) return null;

  if (daysError) {
    return (
      <p className="mt-4 text-sm text-red-400 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
        {daysError}
      </p>
    );
  }

  if (days === null) {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 animate-pulse">
        <div className="h-28 rounded-xl bg-[#252525]" />
        <div className="h-28 rounded-xl bg-[#252525]" />
      </div>
    );
  }

  const day =
    days.find((d) => normalizeSurveyDateKey(d.survey_date) === key && isPendingResult(d)) ??
    null;

  return (
    <div className="mt-4 rounded-xl bg-violet-950/10 px-2 py-2 sm:px-3">
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
        </span>
        <p className={`${surveyUi.body} text-violet-100 tabular-nums`}>
          {formatLiveDateLabel(key)} · {day ? "진행 중 · 실시간 집계" : "진행 중 · 응답 대기"}
        </p>
      </div>
      {day ? (
        <DayCard day={day} emphasize liveKospi={liveKospi} />
      ) : (
        <div
          className={`mx-2 mb-2 rounded-xl border border-dashed border-[#444] px-4 py-6 text-center ${surveyUi.hint}`}
        >
          아직 이 거래일 설문 응답이 없어요. 첫 참여가 들어오면 여기에 무리 분포가 표시됩니다.
        </div>
      )}
    </div>
  );
}
