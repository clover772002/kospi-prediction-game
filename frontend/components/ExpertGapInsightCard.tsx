"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getExpertGapInsight,
  unlockInsightProduct,
  ExpertGapInsightResponse,
  InsightInsufficientTokensError,
} from "@/lib/api";

interface Props {
  accessToken: string;
  surveyDate: string;
  onBalanceUpdated?: () => void;
}

/** 대시보드용: 해당 거래일 고수 괴리 인사이트 (토큰 잠금) */
export default function ExpertGapInsightCard({ accessToken, surveyDate, onBalanceUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ExpertGapInsightResponse | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await getExpertGapInsight(accessToken, surveyDate);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, surveyDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlock = async () => {
    setUnlocking(true);
    setErr(null);
    try {
      await unlockInsightProduct(accessToken, {
        product_slug: "daily_expert_gap",
        survey_date: surveyDate,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await load();
      onBalanceUpdated?.();
    } catch (e: unknown) {
      if (e instanceof InsightInsufficientTokensError) {
        setErr(
          `토큰이 부족해요 · 필요 ${e.detail.required ?? "?"}개 / 보유 ${e.detail.balance ?? "?"}개. 상점에서 충전하거나 더 모아 주세요.`,
        );
      } else {
        setErr(e instanceof Error ? e.message : "잠금 해제 실패");
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#333] mb-2" />
        <div className="h-16 rounded bg-[#222]" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300 fade-up-2">
        인사이트 카드 로드 실패: {err}
        <button type="button" onClick={() => void load()} className="block mt-2 text-xs underline">
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (data.reason === "no_survey_data") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 text-xs text-gray-500 fade-up-2">
        아직 해당 날짜 집계 응답이 없어 괴리 리포트를 만들 수 없어요.
      </div>
    );
  }

  const locked = data.locked === true || !data.accessible;

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/25 to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2 shadow-[0_0_28px_rgba(139,92,246,.08)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black text-violet-300 uppercase tracking-wide">토큰 인사이트</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? "고수·다수결 괴리"}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{data.survey_date}</p>
        </div>
        {locked ? (
          <span className="text-xl shrink-0" aria-hidden>
            🔐
          </span>
        ) : (
          <span className="text-xl shrink-0" aria-hidden>
            ✨
          </span>
        )}
      </div>

      {locked ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            {data.description ??
              "누적 적중 반영 가중예측과 단순 다수결의 차이를 한 장으로 정리합니다. 개인별 응답은 포함하지 않습니다."}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-amber-300 font-black tabular-nums">{data.price_tokens ?? 80} 토큰으로 열람</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500 tabular-nums">보유 {data.balance ?? "–"} 💰</span>
          </div>
          {err ? <p className="text-xs text-orange-400">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={unlocking}
              className="flex-1 min-w-[8rem] py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-black transition-all active:scale-[0.98]"
            >
              {unlocking ? "처리 중…" : "토큰으로 잠금 해제"}
            </button>
            <Link
              href="/shop"
              className="flex-1 min-w-[8rem] py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs font-black text-center leading-none flex items-center justify-center hover:bg-amber-500/20 transition-colors"
            >
              토큰 충전
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug">
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 48)} className="flex gap-2">
                <span className="text-violet-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-4 text-[10px] tabular-nums text-gray-500 pt-1 border-t border-white/[0.06]">
            <span>단순 {data.data?.simple_pct ?? "–"}%</span>
            <span>가중 {data.data?.weighted_pct ?? "–"}%</span>
            <span>괴리 {data.data?.gap_points != null ? `${data.data.gap_points > 0 ? "+" : ""}${data.data.gap_points}` : "–"}pt</span>
          </div>
        </>
      )}
    </div>
  );
}
