"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
import {
  getCrowdConvictionInsight,
  CrowdConvictionInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("crowd_conviction_spread");

interface Props {
  accessToken: string;
  surveyDate: string;
  onBalanceUpdated?: () => void;
}

/** 대시보드용: 무리 확신(게이지) 분포 요약 (토큰 잠금, 최소 표본 n≥20) */
export default function CrowdConvictionInsightCard({ accessToken, surveyDate, onBalanceUpdated }: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<CrowdConvictionInsightResponse | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await getCrowdConvictionInsight(accessToken, surveyDate);
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
        product_slug: "crowd_conviction_spread",
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
        void confirmShopOnInsufficientTokens(e.detail);
      } else {
        alert(e instanceof Error ? e.message : "잠금 해제 실패");
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
        <div className="h-4 w-44 rounded bg-[#333] mb-2" />
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
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일(<span className="text-gray-300 tabular-nums">{data.survey_date}</span>)에는 아직 게이지를 쓸 수 있는 설문 응답이 없어 무리 분포를 만들 수 없어요.
        </p>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          응답이 모이면 이 카드에서 집계를 시도합니다. 최소 <span className="text-gray-500">20</span>명 이상 필요해요.
        </p>
      </div>
    );
  }

  if (data.reason === "insufficient_sample") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일에는 게이지 응답이 있지만, 통계적으로 의미 있는 한 장 요약을 보여 주려면{" "}
          <span className="text-gray-300">최소 20명</span> 이상이 필요해요. 조금 더 모이면 같은 카드에서 열람할 수 있어요.
        </p>
        <p className="text-[10px] text-gray-600 leading-relaxed">교육·게임 회고용 집계이며 투자 권유가 아닙니다.</p>
      </div>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/[0.35] to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2 shadow-[0_0_28px_rgba(251,113,133,.07)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-rose-300 uppercase tracking-wide">토큰 인사이트</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? "무리 확신 분포"}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{data.survey_date}</p>
        </div>
        <div className="flex items-start gap-2 shrink-0 pt-0.5">
          <InsightTokenPriceButton
            priceTokens={priceTokens}
            instantExample={META.instantExample}
            className="border-rose-500/45 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
            locked={locked}
            unlocking={unlocking}
            onActivate={() => void handleUnlock()}
          />
          <span className="text-xl" aria-hidden>
            {locked ? "🔐" : "✨"}
          </span>
        </div>
      </div>
      <InsightDetailDisclosure accentSummaryClass="text-rose-400/85 hover:text-rose-300">
        <p>{META.hint}</p>
        {locked ? (
          <p className="text-gray-500">
            {data.description ??
              "그날 참가자들의 게이지 분포를 한 장으로 요약합니다. 개인별 원시값은 포함하지 않습니다."}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug">
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 48)} className="flex gap-2">
                <span className="text-rose-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 text-[10px] tabular-nums text-gray-500 pt-1 border-t border-white/[0.06]">
            <span>n {data.data?.n ?? "–"}</span>
            <span>평균 {data.data?.mean ?? "–"}</span>
            <span>σ {data.data?.stdev ?? "–"}</span>
            <span>
              Q1~Q3 {data.data?.q1 ?? "–"} / {data.data?.median ?? "–"} / {data.data?.q3 ?? "–"}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
