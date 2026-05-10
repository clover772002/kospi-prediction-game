"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import { insightMeta } from "@/lib/insight_card_meta";
import {
  getRollingCrowdInsight,
  RollingCrowdInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("rolling_crowd_summary");

interface Props {
  accessToken: string;
  /** 대시보드에서 고른 거래일 = 종료 거래일(윈도우 끝) */
  surveyDateAsEndDate: string;
  onBalanceUpdated?: () => void;
}

/** 최근 7거래일 다수결·가중 시계열 (토큰 잠금) */
export default function RollingCrowdInsightCard({
  accessToken,
  surveyDateAsEndDate,
  onBalanceUpdated,
}: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<RollingCrowdInsightResponse | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await getRollingCrowdInsight(accessToken, surveyDateAsEndDate);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, surveyDateAsEndDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlock = async () => {
    setUnlocking(true);
    setErr(null);
    try {
      await unlockInsightProduct(accessToken, {
        product_slug: "rolling_crowd_summary",
        survey_date: surveyDateAsEndDate,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await load();
      onBalanceUpdated?.();
    } catch (e: unknown) {
      if (e instanceof InsightInsufficientTokensError) {
        if (!confirmShopOnInsufficientTokens(e.detail)) {
          setErr(
            `토큰이 부족합니다 · 필요 ${e.detail.required ?? "?"}개 / 보유 ${e.detail.balance ?? "?"}개`,
          );
        }
      } else {
        setErr(e instanceof Error ? e.message : "잠금 해제 실패");
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-20 rounded bg-[#222]" />
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
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 종료 거래일(<span className="text-gray-300 tabular-nums">{data.survey_date}</span>) 근처 7거래일 구간에 표시할 설문 집계가 아직 없어요.
        </p>
      </div>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-b from-sky-950/30 to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2 shadow-[0_0_28px_rgba(56,189,248,.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-sky-300 uppercase tracking-wide">토큰 인사이트</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? "7거래일 무리 요약"}</p>
          <p className="text-[10px] text-gray-600 mt-0.5 tabular-nums">종료 {data.survey_date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InsightTokenPriceButton
            priceTokens={priceTokens}
            className="border-sky-500/45 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
            locked={locked}
            unlocking={unlocking}
            onActivate={() => void handleUnlock()}
          />
          <span className="text-xl" aria-hidden>
            {locked ? "🔐" : "✨"}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-600 leading-relaxed">{META.hint}</p>

      {locked ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            {data.description ??
              "가장 최근 종료 거래일을 기준으로 최근 7거래일의 다수결·가중 축을 한 줄로 묶었습니다."}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-gray-500 tabular-nums">보유 {data.balance ?? "–"} 💰</span>
          </div>
          {err ? <p className="text-xs text-orange-400">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={unlocking}
              className="flex-1 min-w-[8rem] py-3 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-black transition-all active:scale-[0.98]"
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
          <p className="text-[10px] text-gray-500 tabular-nums">열람 기준 {priceTokens} 토큰 · 보유 {data.balance ?? "–"} 💰</p>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="w-full text-[10px] text-left tabular-nums">
              <thead className="text-gray-500 border-b border-white/[0.06]">
                <tr>
                  <th className="py-2 pl-2 pr-1 font-bold">거래일</th>
                  <th className="py-2 px-1 font-bold">n</th>
                  <th className="py-2 px-1 font-bold">다수결</th>
                  <th className="py-2 px-1 font-bold">가중</th>
                  <th className="py-2 pr-2 font-bold">차이</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(data.data?.series ?? []).map((row, i) => (
                  <tr key={row.survey_date + i} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-1.5 pl-2 pr-1 text-gray-400">{row.survey_date.slice(5)}</td>
                    <td className="py-1.5 px-1">{row.n}</td>
                    <td className="py-1.5 px-1">{row.sample_ok && row.simple_pct != null ? `${row.simple_pct}%` : "—"}</td>
                    <td className="py-1.5 px-1">
                      {row.sample_ok && row.weighted_pct != null ? `${row.weighted_pct}%` : "부족"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.sample_ok && row.gap_points != null ? `${row.gap_points > 0 ? "+" : ""}${row.gap_points}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug pt-1">
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 52)} className="flex gap-2">
                <span className="text-sky-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
