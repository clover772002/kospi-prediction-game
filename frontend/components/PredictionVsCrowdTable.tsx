"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCrowdGaugeBoxplots,
  type CrowdGaugeBoxplotDay,
  type HistoryItem,
  type TodaySurvey,
} from "@/lib/api";
import { OUR_PREDICTION_LABEL } from "@/lib/product-copy";

function coerceBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "t" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "f" || s === "no") return false;
  }
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  return null;
}

function dateKey(d: string): string {
  return d.trim().slice(0, 10);
}

function sameSurveyDate(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return dateKey(a) === dateKey(b);
}

function formatColDate(iso: string): string {
  const k = dateKey(iso);
  const parts = k.split("-");
  if (parts.length >= 3) return `${parts[1]}.${parts[2]}`;
  return iso.slice(5).replace("-", ".");
}

function marketDirection(item: HistoryItem, today: TodaySurvey | null): boolean | null {
  const mk = coerceBool(item.kospi_market_result);
  if (mk !== null) return mk;
  if (today?.survey_date && sameSurveyDate(item.date, today.survey_date)) {
    const tr = coerceBool(today.kospi_result);
    if (tr !== null) return tr;
  }
  if (typeof item.kospi_correct === "boolean") {
    return item.kospi_correct ? item.kospi_answer : !item.kospi_answer;
  }
  return null;
}

function crowdMajorityDirection(day: CrowdGaugeBoxplotDay | undefined): boolean | null {
  if (!day) return null;
  const nRise = day.respondents_rise ?? day.rise?.n ?? 0;
  const nFall = day.respondents_fall ?? day.fall?.n ?? 0;
  const total = nRise + nFall;
  if (total === 0) return null;
  if (nRise === nFall) return null;
  if (typeof day.pct_rise === "number" && Number.isFinite(day.pct_rise)) {
    if (day.pct_rise === 50) return null;
    return day.pct_rise > 50;
  }
  return nRise > nFall;
}

function DirectionArrow({
  up,
  compareToMarket,
}: {
  up: boolean | null;
  /** 코스피 행: null → 항상 색. 예측 행: 시장과 다르면 회색 */
  compareToMarket: boolean | null;
}) {
  if (up === null) {
    return <span className="text-white/35 text-lg font-bold">—</span>;
  }
  const sym = up ? "▲" : "▼";
  const matches =
    compareToMarket === null ? true : compareToMarket === up;
  const cls = matches ? (up ? "text-red-400" : "text-blue-400") : "text-gray-500";
  return (
    <span className={`text-2xl font-black leading-none ${cls}`} aria-label={up ? "상승" : "하락"}>
      {sym}
    </span>
  );
}

type Props = {
  history: HistoryItem[];
  today: TodaySurvey | null;
};

export default function PredictionVsCrowdTable({ history, today }: Props) {
  const [crowdDays, setCrowdDays] = useState<CrowdGaugeBoxplotDay[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getCrowdGaugeBoxplots(12);
        if (!cancelled) setCrowdDays(res.days ?? []);
      } catch {
        if (!cancelled) setCrowdDays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => {
    return [...history.slice(0, 5)].reverse();
  }, [history]);

  const crowdByDate = useMemo(() => {
    const m = new Map<string, CrowdGaugeBoxplotDay>();
    for (const d of crowdDays) m.set(dateKey(d.survey_date), d);
    return m;
  }, [crowdDays]);

  if (columns.length === 0) return null;

  const rowLabelCls = "text-left text-sm font-bold text-white/85 py-3 pr-2 whitespace-nowrap";
  const cellCls = "py-3 px-1 sm:px-2 text-center align-middle border-l border-[#2a2a2a]/70 first:border-l-0";

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-white">내 예측 vs {OUR_PREDICTION_LABEL}</p>
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/60 overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/90">
              <th className="w-[4.5rem] py-2.5 pl-3 pr-1" />
              {columns.map((item) => (
                <th
                  key={item.date}
                  className={`${cellCls} py-2.5 text-xs sm:text-sm font-bold text-white tabular-nums`}
                >
                  {formatColDate(item.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2A2A2A]/80">
              <td className={`${rowLabelCls} pl-3`}>코스피</td>
              {columns.map((item) => {
                const mk = marketDirection(item, today);
                return (
                  <td key={`m-${item.date}`} className={cellCls}>
                    <DirectionArrow up={mk} compareToMarket={null} />
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-[#2A2A2A]/80 bg-[#0f0f0f]/30">
              <td className={`${rowLabelCls} pl-3`}>내 예측</td>
              {columns.map((item) => {
                const mk = marketDirection(item, today);
                const mine = item.kospi_answer;
                return (
                  <td key={`my-${item.date}`} className={cellCls}>
                    <DirectionArrow
                      up={mine}
                      compareToMarket={mk === null ? null : mk}
                    />
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className={`${rowLabelCls} pl-3`}>{OUR_PREDICTION_LABEL}</td>
              {columns.map((item) => {
                const mk = marketDirection(item, today);
                const crowd = crowdMajorityDirection(crowdByDate.get(dateKey(item.date)));
                return (
                  <td key={`c-${item.date}`} className={cellCls}>
                    <DirectionArrow
                      up={crowd}
                      compareToMarket={mk === null ? null : mk}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/55 leading-snug">
        ▲ 상승 · ▼ 하락 · — 동률(우리 예측) 또는 결과 미정(코스피) · 코스피와 같으면 색, 다르면 회색
      </p>
    </div>
  );
}
