"use client";

import { useEffect, useState } from "react";
import { getWeeklySurvivalBoard, type WeeklySurvivalBoardData, type WeeklyPredictionVerdict } from "@/lib/api";

function KospiDirection({ value }: { value: boolean | null }) {
  if (value === null) return null;
  const up = value;
  const sym = up ? "▲" : "▼";
  const cls = up ? "text-red-400" : "text-blue-400";
  return (
    <span className={`text-2xl font-black leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${cls}`}>
      {sym}
    </span>
  );
}

function PredictionCell({ verdict }: { verdict: WeeklyPredictionVerdict }) {
  if (verdict === "none" || verdict === "pending") return null;
  if (verdict === "not_submitted") {
    return (
      <span className="text-[11px] font-bold text-white/45 leading-tight">미제출</span>
    );
  }
  if (verdict === "hit") {
    return (
      <div
        className="mx-auto w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_10px_rgba(34,197,94,0.45)] border border-green-400/40"
        style={{
          background: "radial-gradient(circle at 35% 30%, #4ade80, #16a34a 70%)",
        }}
        title="적중"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <span className="text-[11px] font-bold text-red-400/90 leading-tight">미적중</span>
  );
}

function SurvivorCountCell({
  isTradingDay,
  count,
}: {
  isTradingDay: boolean;
  count: number | null;
}) {
  if (!isTradingDay) {
    return <span className="text-sm text-white/25">—</span>;
  }
  if (count == null) return null;
  return (
    <span className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums leading-none">
      {count}
    </span>
  );
}

type Props = {
  token: string | null;
};

export default function WeeklySurvivalBoard({ token }: Props) {
  const [board, setBoard] = useState<WeeklySurvivalBoardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await getWeeklySurvivalBoard(token);
        if (!cancelled) setBoard(data);
      } catch {
        if (!cancelled) setBoard(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/60 p-5 animate-pulse">
        <div className="h-5 w-32 bg-[#2A2A2A] rounded mb-4" />
        <div className="h-24 bg-[#1A1A1A] rounded-xl" />
      </div>
    );
  }

  if (!board || board.columns.length === 0) return null;

  const rowLabelCls = "text-left text-sm font-bold text-white/85 py-3 pr-2 whitespace-nowrap";
  const cellCls = "py-2.5 px-1 sm:px-2 text-center align-middle border-l border-[#2a2a2a]/70 first:border-l-0";

  const myStatusLabel = board.my_alive ? "생존" : "탈락";
  const myStatusCls = board.my_alive
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/30 bg-red-500/10 text-red-300";

  return (
    <div className="space-y-3 fade-up-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-black text-white">이번 주 생존전</p>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-sm font-black border ${myStatusCls}`}
        >
          {myStatusLabel}
        </span>
      </div>

      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/60 overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/90">
              <th className="w-[4.5rem] py-2.5 pl-3 pr-1" />
              {board.columns.map((col) => (
                <th key={col.calendar_date} className={`${cellCls} py-2.5`}>
                  <span className="text-sm font-black text-white">{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2A2A2A]/80">
              <td className={`${rowLabelCls} pl-3`}>코스피</td>
              {board.columns.map((col) => (
                <td key={`k-${col.calendar_date}`} className={cellCls}>
                  {col.is_trading_day ? (
                    <KospiDirection value={col.kospi_result} />
                  ) : (
                    <span className="text-[10px] text-white/30">—</span>
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#2A2A2A]/80 bg-[#0f0f0f]/30">
              <td className={`${rowLabelCls} pl-3`}>내 예측</td>
              {board.columns.map((col) => (
                <td key={`p-${col.calendar_date}`} className={cellCls}>
                  {col.is_trading_day ? (
                    <PredictionCell verdict={col.my_prediction} />
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <td className={`${rowLabelCls} pl-3`}>생존</td>
              {board.columns.map((col) => (
                <td key={`s-${col.calendar_date}`} className={`${cellCls} py-3`}>
                  <SurvivorCountCell
                    isTradingDay={col.is_trading_day}
                    count={col.survivor_count}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
