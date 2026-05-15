"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightCardHeroGrid from "@/components/InsightCardHeroGrid";
import InsightUnavailableCard from "@/components/InsightUnavailableCard";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
import { useInsightDashLayout } from "@/hooks/useInsightDashLayout";
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

/** 상승·하락 선택 무리별 확신도(게이지) 분포 (토큰 잠금) */
export default function CrowdConvictionInsightCard({ accessToken, surveyDate, onBalanceUpdated }: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const ix = useInsightDashLayout();
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
      <div className={`${ix.cardRound} border border-rose-500/25 bg-rose-500/[0.06] ${ix.cardPad} fade-up-2 animate-pulse`}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,40%)] gap-2 items-stretch min-h-[46px]">
          <div className="flex flex-col justify-center gap-2">
            <div className="space-y-1">
              <div className={`${ix.c ? "h-1.5 w-24" : "h-2 w-28"} rounded bg-[#333]`} />
              <div className={`${ix.c ? "h-3 w-full max-w-[8rem]" : "h-3.5 w-full max-w-[11rem]"} rounded bg-[#2a2a2a]`} />
            </div>
            <div className={`${ix.c ? "h-5 w-20" : "h-6 w-28"} rounded bg-[#333]`} />
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a]/80 min-h-[36px]" />
        </div>
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
      <InsightUnavailableCard
        variant="rose"
        slug="crowd_conviction_spread"
        title={data.title ?? "확신도 분포"}
        surveyDate={data.survey_date}
      >
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일(<span className="text-gray-300 tabular-nums">{data.survey_date}</span>)에는 아직 게이지를 쓸 수 있는 설문 응답이 없어 무리 분포를 만들 수 없어요.
        </p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          응답이 모이면 이 카드에서 집계를 시도합니다. 최소 <span className="text-gray-400">20</span>명 이상 필요해요.
        </p>
      </InsightUnavailableCard>
    );
  }

  if (data.reason === "insufficient_sample") {
    return (
      <InsightUnavailableCard
        variant="rose"
        slug="crowd_conviction_spread"
        title={data.title ?? "확신도 분포"}
        surveyDate={data.survey_date}
      >
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일에는 게이지 응답이 있지만, 통계적으로 의미 있는 한 장 요약을 보여 주려면{" "}
          <span className="text-gray-300">최소 20명</span> 이상이 필요해요. 조금 더 모이면 같은 카드에서 열람할 수 있어요.
        </p>
        <p className="text-[10px] text-gray-500 leading-relaxed">교육·게임 회고용 집계이며 투자 권유가 아닙니다.</p>
      </InsightUnavailableCard>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div
      className={`${ix.cardRound} border border-rose-500/30 bg-gradient-to-b from-rose-950/[0.35] to-[#141414]/90 ${ix.cardPad} ${ix.cardGap} fade-up-2 ${
        ix.c ? "" : "shadow-[0_0_28px_rgba(251,113,133,.07)]"
      }`}
    >
      <InsightCardHeroGrid
        slug="crowd_conviction_spread"
        headline={
          <>
            <p className={`${ix.badge} font-black text-rose-300 uppercase tracking-wide`}>토큰 인사이트</p>
            <p className={`${ix.titleClass} text-white mt-0.5`}>{data.title ?? "확신도 분포"}</p>
            <p className={`${ix.subDate} text-gray-600 mt-0.5`}>{data.survey_date}</p>
          </>
        }
        tokenRow={
          <>
            <InsightTokenPriceButton
              priceTokens={priceTokens}
              className="border-rose-500/45 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
              locked={locked}
              unlocking={unlocking}
              onActivate={() => void handleUnlock()}
            />
            <span className={ix.icon} aria-hidden>
              {locked ? "🔐" : "✨"}
            </span>
          </>
        }
      />
      <InsightDetailDisclosure accentSummaryClass="text-rose-400/85 hover:text-rose-300">
        <p>{META.hint}</p>
        {locked ? (
          <p className="text-gray-500">
            {data.description ?? "상승을 택한 무리와 하락을 택한 무리로 나누어 확신도(게이지) 분포만 요약합니다."}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className={`${ix.computed} text-gray-500`}>{data.data?.computed_note}</p>
          <p className={`${ix.computed} text-gray-500 tabular-nums`}>
            방향·게이지 동시 기준 {data.data?.total_n ?? "–"}명 · 상승 선택 {data.data?.rise_choice_count ?? "–"} · 하락 선택{" "}
            {data.data?.fall_choice_count ?? "–"}
          </p>
          <div className={`grid gap-2 ${ix.c ? "grid-cols-1" : "sm:grid-cols-2"}`}>
            <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1.5 space-y-0.5">
              <p className={`${ix.c ? "text-[9px]" : "text-[10px]"} font-bold text-rose-200/90`}>상승 선택 무리</p>
              {data.data?.rise_choice_stats ? (
                <div className={`tabular-nums text-gray-400 ${ix.c ? "text-[9px] space-y-0.5" : "text-[10px] space-y-0.5"}`}>
                  <p>
                    n {data.data.rise_choice_stats.n} · 평균 {data.data.rise_choice_stats.mean} · |평균|{" "}
                    {data.data.rise_choice_stats.mean_abs}
                  </p>
                  <p>
                    Q1~Q3 {data.data.rise_choice_stats.q1} / {data.data.rise_choice_stats.median} /{" "}
                    {data.data.rise_choice_stats.q3} · σ {data.data.rise_choice_stats.stdev}
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500">해당 표본 없음</p>
              )}
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1.5 space-y-0.5">
              <p className={`${ix.c ? "text-[9px]" : "text-[10px]"} font-bold text-rose-200/90`}>하락 선택 무리</p>
              {data.data?.fall_choice_stats ? (
                <div className={`tabular-nums text-gray-400 ${ix.c ? "text-[9px] space-y-0.5" : "text-[10px] space-y-0.5"}`}>
                  <p>
                    n {data.data.fall_choice_stats.n} · 평균 {data.data.fall_choice_stats.mean} · |평균|{" "}
                    {data.data.fall_choice_stats.mean_abs}
                  </p>
                  <p>
                    Q1~Q3 {data.data.fall_choice_stats.q1} / {data.data.fall_choice_stats.median} /{" "}
                    {data.data.fall_choice_stats.q3} · σ {data.data.fall_choice_stats.stdev}
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500">해당 표본 없음</p>
              )}
            </div>
          </div>
          <ul className={`${ix.list} text-gray-300 pt-1`}>
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 48)} className="flex gap-2">
                <span className="text-rose-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
