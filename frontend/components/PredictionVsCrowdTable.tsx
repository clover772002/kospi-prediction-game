"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCrowdGaugeBoxplots,
  type CrowdGaugeBoxplotDay,
  type HistoryItem,
} from "@/lib/api";
import { OUR_PREDICTION_LABEL } from "@/lib/product-copy";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PublicMarketDay = {
  date: string;
  actual_up: unknown;
};

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

function formatColDate(iso: string): string {
  const k = dateKey(iso);
  const parts = k.split("-");
  if (parts.length >= 3) return `${parts[1]}.${parts[2]}`;
  return iso.slice(5).replace("-", ".");
}

type CellValue = "pending" | "tie" | boolean;

function crowdCellValue(day: CrowdGaugeBoxplotDay | undefined): CellValue {
  if (!day) return "pending";
  const nRise = day.respondents_rise ?? day.rise?.n ?? 0;
  const nFall = day.respondents_fall ?? day.fall?.n ?? 0;
  const total = nRise + nFall;
  if (total === 0) return "pending";
  if (nRise === nFall) return "tie";
  if (typeof day.pct_rise === "number" && Number.isFinite(day.pct_rise)) {
    if (day.pct_rise === 50) return "tie";
    return day.pct_rise > 50;
  }
  return nRise > nFall;
}

function myCellValue(userItem: HistoryItem | undefined): CellValue {
  if (!userItem) return "pending";
  return userItem.kospi_answer;
}

function DirectionCell({
  value,
  compareToMarket,
}: {
  value: CellValue;
  compareToMarket: boolean | null;
}) {
  if (value === "pending") return null;
  if (value === "tie") {
    return <span className="text-white/45 text-lg font-bold">—</span>;
  }
  const up = value;
  const sym = up ? "▲" : "▼";
  const matches = compareToMarket === null ? true : compareToMarket === up;
  const cls = matches ? (up ? "text-red-400" : "text-blue-400") : "text-gray-500";
  return <span className={`text-2xl font-black leading-none ${cls}`}>{sym}</span>;
}

type Props = {
  /** 내가 응답한 날만 포함 — 열(거래일)과 무관하게 날짜로 매칭 */
  userHistory: HistoryItem[];
};

export default function PredictionVsCrowdTable({ userHistory }: Props) {
  const [marketDays, setMarketDays] = useState<PublicMarketDay[]>([]);
  const [crowdDays, setCrowdDays] = useState<CrowdGaugeBoxplotDay[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [histRes, crowdRes] = await Promise.all([
          fetch("/api/public/history", { cache: "no-store" }).then((r) => r.json()),
          getCrowdGaugeBoxplots(12),
        ]);
        if (cancelled) return;
        const rows = (histRes.history ?? [])
          .filter(
            (row: { date?: string }) =>
              typeof row.date === "string" && DATE_RE.test(row.date),
          )
          .slice(0, 5) as PublicMarketDay[];
        setMarketDays(rows);
        setCrowdDays(crowdRes.days ?? []);
      } catch {
        if (!cancelled) {
          setMarketDays([]);
          setCrowdDays([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => [...marketDays].reverse(), [marketDays]);

  const userByDate = useMemo(() => {
    const m = new Map<string, HistoryItem>();
    for (const h of userHistory) m.set(dateKey(h.date), h);
    return m;
  }, [userHistory]);

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
      <div>
        <p className="text-sm font-bold text-white">내 예측 vs {OUR_PREDICTION_LABEL}</p>
        <p className="text-xs text-white/50 mt-0.5">최근 코스피 실적이 나온 5거래일</p>
      </div>
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/60 overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/90">
              <th className="w-[4.5rem] py-2.5 pl-3 pr-1" />
              {columns.map((day) => (
                <th
                  key={day.date}
                  className={`${cellCls} py-2.5 text-xs sm:text-sm font-bold text-white tabular-nums`}
                >
                  {formatColDate(day.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2A2A2A]/80">
              <td className={`${rowLabelCls} pl-3`}>코스피</td>
              {columns.map((day) => {
                const mk = coerceBool(day.actual_up);
                return (
                  <td key={`m-${day.date}`} className={cellCls}>
                    <DirectionCell
                      value={mk === null ? "pending" : mk}
                      compareToMarket={null}
                    />
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-[#2A2A2A]/80 bg-[#0f0f0f]/30">
              <td className={`${rowLabelCls} pl-3`}>내 예측</td>
              {columns.map((day) => {
                const dk = dateKey(day.date);
                const mk = coerceBool(day.actual_up);
                const mine = myCellValue(userByDate.get(dk));
                return (
                  <td key={`my-${day.date}`} className={cellCls}>
                    <DirectionCell value={mine} compareToMarket={mk} />
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className={`${rowLabelCls} pl-3`}>{OUR_PREDICTION_LABEL}</td>
              {columns.map((day) => {
                const dk = dateKey(day.date);
                const mk = coerceBool(day.actual_up);
                const crowd = crowdCellValue(crowdByDate.get(dk));
                return (
                  <td key={`c-${day.date}`} className={cellCls}>
                    <DirectionCell value={crowd} compareToMarket={mk} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/50">동률 —</p>
    </div>
  );
}
