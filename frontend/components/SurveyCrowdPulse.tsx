"use client";

import { useEffect, useMemo, useState } from "react";

/** 거래일·시간 버킷 기준 가벼운 「방금 N명」 힌트(데모용, 실명 로그 아님) */
function useRecentJoinHint(surveyDate: string, enabled: boolean): string | null {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !surveyDate) {
      setHint(null);
      return;
    }
    const tick = () => {
      const bucket = Math.floor(Date.now() / 14_000);
      let h = 0;
      const s = `${surveyDate}:${bucket}`;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      const n = 1 + (h % 5);
      setHint(`방금 ${n}명 참여`);
    };
    tick();
    const id = window.setInterval(tick, 14_000);
    return () => window.clearInterval(id);
  }, [surveyDate, enabled]);

  return hint;
}

/** 설문 탭 — 지금 몇 명이 북적이는지 숫자·비율 막대 */
export default function SurveyCrowdPulse({
  surveyDate,
  total,
  yesPct,
  riseCount,
  fallCount,
  active,
}: {
  surveyDate: string;
  total: number;
  yesPct: number | null;
  riseCount?: number | null;
  fallCount?: number | null;
  /** 장 진행·마감 후 등 활발 구간 */
  active?: boolean;
}) {
  const hint = useRecentJoinHint(surveyDate, active !== false && total > 0);

  const rise = riseCount ?? (yesPct != null ? Math.round((total * yesPct) / 100) : null);
  const fall = fallCount ?? (rise != null ? Math.max(0, total - rise) : null);

  const bar = useMemo(() => {
    if (yesPct == null) return null;
    const up = Math.max(4, Math.min(96, yesPct));
    return up;
  }, [yesPct]);

  if (!total || total <= 0) return null;

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/12 to-indigo-600/5 px-4 py-3.5 shadow-[0_0_24px_rgba(139,92,246,0.08)]">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <p className="text-sm text-gray-300 leading-snug">
          지금{" "}
          <strong className="text-lg font-black text-white tabular-nums">
            {total.toLocaleString("ko-KR")}명
          </strong>
          이 예측 중
        </p>
        {hint ? (
          <span className="w-full text-xs font-bold text-emerald-400/90 animate-pulse">{hint}</span>
        ) : null}
      </div>

      {bar != null && rise != null && fall != null ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-market-up transition-all duration-700"
              style={{ width: `${bar}%` }}
            />
            <div className="flex-1 bg-market-down" />
          </div>
          <div className="flex justify-between text-xs font-bold tabular-nums">
            <span className="text-market-up">상승 {rise.toLocaleString("ko-KR")}명</span>
            <span className="text-market-down">하락 {fall.toLocaleString("ko-KR")}명</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
