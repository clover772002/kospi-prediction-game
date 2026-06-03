"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightCardHeroGrid from "@/components/InsightCardHeroGrid";
import InsightUnavailableCard from "@/components/InsightUnavailableCard";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightUnlockShopHint from "@/components/InsightUnlockShopHint";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
import { useInsightDashLayout } from "@/hooks/useInsightDashLayout";
import {
  getExpertGapInsight,
  unlockInsightProduct,
  ExpertGapInsightResponse,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("daily_expert_gap");

interface Props {
  accessToken: string;
  surveyDate: string;
  onBalanceUpdated?: () => void;
  /** 대시보드: 잠금 해제 버튼은 아이템 탭 전용 */
  hideUnlockControl?: boolean;
}

/** 대시보드용: 해당 거래일 고수·다수결 차이 아이템 (칩 잠금) */
export default function ExpertGapInsightCard({
  accessToken,
  surveyDate,
  onBalanceUpdated,
  hideUnlockControl = false,
}: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const d = useInsightDashLayout();
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
      <div
        className={`${d.cardRound} border border-violet-500/25 bg-violet-500/[0.06] ${d.cardPad} fade-up-2 animate-pulse`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,40%)] gap-2 items-stretch min-h-[46px]">
          <div className="flex flex-col justify-center gap-2">
            <div className="space-y-1">
              <div className={`${d.c ? "h-1.5 w-24" : "h-2 w-28"} rounded bg-[#333]`} />
              <div className={`${d.c ? "h-3 w-full max-w-[8rem]" : "h-3.5 w-full max-w-[11rem]"} rounded bg-[#2a2a2a]`} />
            </div>
            <div className={`${d.c ? "h-5 w-20" : "h-6 w-28"} rounded bg-[#333]`} />
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a]/80 min-h-[36px]" />
        </div>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300 fade-up-2">
        아이템 카드 로드 실패: {err}
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
        variant="violet"
        slug="daily_expert_gap"
        title={data.title ?? "고수·다수결 차이"}
        surveyDate={data.survey_date}
      >
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일(<span className="text-gray-300 tabular-nums">{data.survey_date}</span>)에는 아직 설문 응답이 없어 차이 리포트를 만들 수 없어요.
        </p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          설문이 열린 뒤 참여자 응답이 쌓이면 같은 카드에서 집계가 표시됩니다. 장 시작 전·직후에는 비어 있는 경우가 있어요.
        </p>
      </InsightUnavailableCard>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div
      className={`${d.cardRound} border border-violet-500/30 bg-gradient-to-b from-violet-950/25 to-[#141414]/90 ${d.cardPad} ${d.cardGap} fade-up-2 ${
        d.c ? "" : "shadow-[0_0_28px_rgba(139,92,246,.08)]"
      }`}
    >
      <InsightCardHeroGrid
        slug="daily_expert_gap"
        headline={
          <>
            <p className={`${d.badge} font-black text-violet-300 uppercase tracking-wide`}>아이템</p>
            <p className={`${d.titleClass} text-white mt-0.5`}>{data.title ?? "고수·다수결 차이"}</p>
            <p className={`${d.subDate} text-gray-600 mt-0.5`}>{data.survey_date}</p>
          </>
        }
        tokenRow={
          <>
            {!hideUnlockControl ? (
              <InsightTokenPriceButton
                priceTokens={priceTokens}
                className="border-violet-500/45 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
                locked={locked}
                unlocking={unlocking}
                onActivate={() => void handleUnlock()}
              />
            ) : locked ? (
              <span className="rounded-lg font-black tabular-nums border px-2.5 py-1 text-[11px] whitespace-nowrap border-violet-500/35 bg-violet-500/10 text-violet-200/80">
                {priceTokens} 칩
              </span>
            ) : null}
            <span className={d.icon} aria-hidden>
              {locked ? "🔐" : "✨"}
            </span>
          </>
        }
      />
      <InsightDetailDisclosure accentSummaryClass="text-violet-400/85 hover:text-violet-300">
        <p>{META.hint}</p>
        {locked ? (
          <>
            <p className="text-gray-500">
              {data.description ??
                "누적 적중 반영 가중예측과 단순 다수결의 차이를 한 장으로 정리합니다. 개인별 응답은 포함하지 않습니다."}
            </p>
            {hideUnlockControl ? <InsightUnlockShopHint /> : null}
          </>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className={`${d.computed} text-gray-500`}>{data.data?.computed_note}</p>
          <ul className={`${d.list} text-gray-300`}>
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 48)} className="flex gap-2">
                <span className="text-violet-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className={`flex ${d.dash} tabular-nums text-gray-500 pt-1 border-t border-white/[0.06]`}>
            <span>단순 {data.data?.simple_pct ?? "–"}%</span>
            <span>가중 {data.data?.weighted_pct ?? "–"}%</span>
            <span>차이 {data.data?.gap_points != null ? `${data.data.gap_points > 0 ? "+" : ""}${data.data.gap_points}` : "–"}pt</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
