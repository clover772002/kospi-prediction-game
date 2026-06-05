"use client";

import { useEffect, useState } from "react";
import { getWeeklySurvivalBoard, type WeeklySurvivalBoardData } from "@/lib/api";

type PredictionVerdict = "none" | "pending" | "hit" | "miss";
type SurvivalStatus = "not_trading" | "pending" | "alive" | "eliminated" | "missed";

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

function HitMissBadge({ verdict }: { verdict: PredictionVerdict }) {
  if (verdict === "none" || verdict === "pending") return null;
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
    <div
      className="mx-auto w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_10px_rgba(239,68,68,0.4)] border border-red-400/35"
      style={{
        background: "radial-gradient(circle at 35% 30%, #f87171, #dc2626 70%)",
      }}
      title="미적중"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SurvivalBadge({ status }: { status: SurvivalStatus }) {
  if (status === "not_trading") {
    return <span className="text-[10px] text-white/35 font-bold">휴장</span>;
  }
  if (status === "pending") return null;
  if (status === "alive") {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 whitespace-nowrap">
        생존
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black text-red-300 bg-red-500/15 border border-red-500/35 whitespace-nowrap">
      탈락
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

  return (
    <div className="space-y-3 fade-up-1">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-base font-black text-white">이번 주 생존전</p>
          <p className="text-xs text-white/50 mt-0.5">월~금 · 적중하면 생존, 틀리거나 미참여 시 탈락</p>
        </div>
        {board.current_survivors != null && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">현재 생존</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums leading-none">
              {board.current_survivors}
              <span className="text-sm text-white/60 font-bold ml-0.5">명</span>
            </p>
          </div>
        )}
      </div>

      {board.my_alive === false && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-2.5 text-sm text-red-200/90 font-bold text-center">
          이번 주 생존전에서 탈락했어요
        </div>
      )}
      {board.my_alive === true && board.current_survivors != null && board.cohort_size != null && board.cohort_size > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-2 text-xs text-emerald-200/80 text-center">
          아직 생존 중 · 이번 주 {board.cohort_size}명 중 {board.current_survivors}명 남음
        </div>
      )}

      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/60 overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/90">
              <th className="w-[4.5rem] py-2.5 pl-3 pr-1" />
              {board.columns.map((col) => (
                <th key={col.calendar_date} className={`${cellCls} py-2.5`}>
                  <span className="text-sm font-black text-white">{col.label}</span>
                  {col.is_trading_day && col.survivor_count != null && (
                    <p className="text-[9px] text-emerald-400/80 font-bold mt-0.5 tabular-nums">
                      {col.survivor_count}명
                    </p>
                  )}
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
                    <HitMissBadge verdict={col.my_prediction} />
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <td className={`${rowLabelCls} pl-3`}>생존</td>
              {board.columns.map((col) => (
                <td key={`s-${col.calendar_date}`} className={cellCls}>
                  <SurvivalBadge status={col.my_survival} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
