"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightInstantExampleLine from "@/components/InsightInstantExampleLine";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
import {
  getGaugeCrowdInsight,
  unlockInsightProduct,
  GaugeCrowdInsightResponse,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("my_gauge_vs_crowd");

interface Props {
  accessToken: string;
  surveyDate: string;
  onBalanceUpdated?: () => void;
}

const PRODUCT_SLUG = "my_gauge_vs_crowd";

const MIN_SAME_DIRECTION_PEER = 5;

/** 그날 같은 방향 무리 속 내 확신도 위치 (토큰 잠금) */
export default function GaugeCrowdInsightCard({ accessToken, surveyDate, onBalanceUpdated }: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<GaugeCrowdInsightResponse | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await getGaugeCrowdInsight(accessToken, surveyDate);
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
        product_slug: PRODUCT_SLUG,
        survey_date: surveyDate,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `unlock-cc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
      <div className="rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#333] mb-2" />
        <div className="h-16 rounded bg-[#222]" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300 fade-up-2">
        확신 비교 카드 로드 실패: {err}
        <button type="button" onClick={() => void load()} className="block mt-2 text-xs underline">
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (data.reason === "not_participated") {
    return (
      <div className="rounded-2xl border border-teal-500/25 bg-[#141414]/80 px-4 py-4 space-y-2 fade-up-2">
        <p className="text-[10px] font-black text-teal-300 uppercase tracking-wide">토큰 인사이트</p>
        <p className="text-sm font-black text-white">{data.title ?? "내 확신도, 같은 편 속 위치"}</p>
        <p className="text-xs text-gray-400">
          그날(<span className="tabular-nums text-gray-300">{data.survey_date}</span>) 설문에 아직 참여하지 않았어요. 같은 편 속 비교를 보려면 먼저 설문을 제출해 주세요.
        </p>
        <Link
          href="/survey"
          className="inline-block mt-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black text-center w-full transition-colors"
        >
          설문 하러 가기
        </Link>
      </div>
    );
  }

  if (data.reason === "no_survey_data") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 text-xs text-gray-500 fade-up-2 space-y-1">
        <p>
          거래일 <span className="tabular-nums text-gray-400">{data.survey_date}</span>에 유효한 게이지 응답이 부족해 비교 카드를 만들 수 없어요.
        </p>
      </div>
    );
  }

  if (data.reason === "cohort_too_small") {
    return (
      <div className="rounded-2xl border border-orange-500/25 bg-orange-950/20 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-orange-200/90">{data.title}</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          같은 방향(상승 또는 하락)으로 응답한 사람이 최소 {MIN_SAME_DIRECTION_PEER}명은 있어야 익명으로 무리 속 위치를 보여 줄 수 있어요. 사람이 더 모이면 이 카드를 다시 열어보세요.
        </p>
      </div>
    );
  }

  const paywallLocked = data.locked === true;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-950/25 to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2 shadow-[0_0_28px_rgba(45,212,191,.07)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-teal-300 uppercase tracking-wide">토큰 인사이트</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? "내 확신도, 같은 편 속 위치"}</p>
          <InsightInstantExampleLine text={META.instantExample} />
          <p className="text-[10px] text-gray-600 mt-0.5">{data.survey_date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InsightTokenPriceButton
            priceTokens={priceTokens}
            className="border-teal-500/45 bg-teal-500/15 text-teal-100 hover:bg-teal-500/25"
            locked={paywallLocked}
            unlocking={unlocking}
            onActivate={() => void handleUnlock()}
          />
          <span className="text-xl" aria-hidden>
            {paywallLocked ? "🔐" : "🪞"}
          </span>
        </div>
      </div>
      <InsightDetailDisclosure accentSummaryClass="text-teal-400/85 hover:text-teal-300">
        <p>{META.hint}</p>
        {paywallLocked ? (
          <p className="text-gray-500">
            {data.description ??
              "같은 방향으로 예측한 참가자들 가운데서 내 확신(게이지) 세기가 어느 쪽인지 보여 줍니다. 매매 조언은 아니에요."}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {paywallLocked ? null : (
        <>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <div className="flex gap-4 text-[11px] tabular-nums text-gray-400 flex-wrap pt-1">
            <span>
              무리 속 밴드:{" "}
              <span className="text-teal-300 font-bold">{data.data?.conviction_band ?? "–"}</span>
            </span>
            <span>내 게이지 {data.data?.my_gauge != null ? `${data.data.my_gauge > 0 ? "+" : ""}${data.data.my_gauge}` : "–"}</span>
            <span>약한 편 비율 쪽 {data.data?.strength_vs_cohort_pct ?? "–"}%</span>
            <span>무리 {data.data?.cohort_size ?? "–"}명</span>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug">
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 48)} className="flex gap-2">
                <span className="text-teal-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}