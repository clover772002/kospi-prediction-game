"use client";

import type { WeeklySurvivalBoardData, WeeklyPredictionVerdict } from "@/lib/api";
import { useWeeklySurvivalBoard } from "@/hooks/useWeeklySurvivalBoard";

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

export function TournamentResultsTable({
  board,
  loading,
}: {
  board: WeeklySurvivalBoardData | null;
  loading: boolean;
}) {
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
      <p className="text-base font-black text-white">이번 주 대회 결과</p>
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
              <td className={`${rowLabelCls} pl-3`}>내 선택</td>
              {board.columns.map((col) => (
                <td key={`p-${col.calendar_date}`} className={cellCls}>
                  {col.is_trading_day ? (
                    <PredictionCell verdict={col.my_prediction} />
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <td className={`${rowLabelCls} pl-3`}>생존자</td>
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

export function WeeklyMyStatusCard({
  board,
  loading,
}: {
  board: WeeklySurvivalBoardData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 animate-pulse fade-up-1">
        <div className="h-5 w-24 bg-[#2A2A2A] rounded mb-4" />
        <div className="h-16 bg-[#252525] rounded-xl" />
      </div>
    );
  }

  if (!board) return null;

  const alive = board.my_alive;
  const borderCls = alive
    ? "border-emerald-500/35 bg-emerald-500/8"
    : "border-red-500/35 bg-red-500/8";
  const labelCls = alive ? "text-emerald-300" : "text-red-300";
  const statusLabel = alive ? "생존" : "탈락";
  const subline = alive
    ? board.current_survivors != null
      ? `현재 ${board.current_survivors}명이 대회에 남아 있어요`
      : "이번 주 대회에 아직 참가 중이에요"
    : "이번 주 대회에서 탈락했어요";

  return (
    <div className={`rounded-2xl border p-5 fade-up-1 ${borderCls}`}>
      <p className="text-sm font-bold text-white/70 mb-3">내 대회 상태</p>
      <div className="flex items-center justify-between gap-4">
        <p className={`text-4xl sm:text-5xl font-black tracking-tight ${labelCls}`}>
          {statusLabel}
        </p>
        {board.current_survivors != null && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-white/45 uppercase tracking-wide">생존자</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums">
              {board.current_survivors}
              <span className="text-sm text-white/50 font-bold ml-0.5">명</span>
            </p>
          </div>
        )}
      </div>
      <p className="text-sm text-white/55 mt-3">{subline}</p>
    </div>
  );
}

type Props = {
  token: string | null;
};

/** 상단 주간 대회 결과 표 */
export default function WeeklySurvivalBoard({ token }: Props) {
  const { board, loading } = useWeeklySurvivalBoard(token);
  return <TournamentResultsTable board={board} loading={loading} />;
}

export { useWeeklySurvivalBoard };
