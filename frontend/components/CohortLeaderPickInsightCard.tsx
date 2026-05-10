"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import InsightUnavailableCard from "@/components/InsightUnavailableCard";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta, type InsightProductSlug } from "@/lib/insight_card_meta";
import {
  getExpertLeaderPickInsight,
  getNoviceLeaderPickInsight,
  LeaderPickInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

interface Props {
  accessToken: string;
  surveyDate: string;
  cohort: "expert" | "novice";
  onBalanceUpdated?: () => void;
}

/** 고수층·하수층 규격 안 그날 1순위 한 명의 코스피 방향 픽(파도 B) */

export default function CohortLeaderPickInsightCard({
  accessToken,
  surveyDate,
  cohort,
  onBalanceUpdated,
}: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const slug = cohort === "expert" ? "expert_leader_pick" : "novice_leader_pick";
  const META = useMemo(() => insightMeta(slug as InsightProductSlug), [slug]);

  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<LeaderPickInsightResponse | null>(null);

  const accentBorder = cohort === "expert" ? "border-violet-500/35" : "border-slate-500/35";
  const accentText = cohort === "expert" ? "text-violet-300" : "text-slate-300";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r =
        cohort === "expert"
          ? await getExpertLeaderPickInsight(accessToken, surveyDate)
          : await getNoviceLeaderPickInsight(accessToken, surveyDate);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, surveyDate, cohort]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlock = async () => {
    setUnlocking(true);
    setErr(null);
    try {
      await unlockInsightProduct(accessToken, {
        product_slug: slug,
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
        className={`rounded-2xl border px-4 py-4 fade-up-2 animate-pulse ${
          cohort === "expert"
            ? "border-violet-500/25 bg-violet-500/[0.06]"
            : "border-slate-500/25 bg-slate-500/[0.06]"
        }`}
      >
        <div className="h-4 w-56 rounded bg-[#333] mb-2" />
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

  const softReason = () => {
    switch (data.reason) {
      case "no_survey_data":
        return "이 거래일에는 설문 응답이 없거나 해당 인원의 선택을 찾을 수 없습니다.";
      case "segment_empty":
        return "고수/하수층을 나눌 만한 자격 응답자가 아직 부족합니다.";
      case "insufficient_segment_size":
        return "무리 규격 세그먼트 반응이 최소 인원(5명) 미만이라 표시하지 않습니다.";
      default:
        return null;
    }
  };

  if (data.reason === "no_survey_data" || data.reason === "segment_empty" || data.reason === "insufficient_segment_size") {
    const body = softReason();
    const v = cohort === "expert" ? "violet" : "slate";
    const defaultTitle = cohort === "expert" ? "고수 1위 픽" : "하수 1위 픽";
    return (
      <InsightUnavailableCard
        variant={v}
        slug={slug as InsightProductSlug}
        title={data.title ?? defaultTitle}
        surveyDate={data.survey_date}
        badgeExtra="· 파도 B"
      >
        {body ? <p className="text-xs text-gray-400 leading-relaxed">{body}</p> : null}
      </InsightUnavailableCard>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;
  const priceChipClass =
    cohort === "expert"
      ? "border-violet-500/45 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
      : "border-slate-500/45 bg-slate-600/20 text-slate-100 hover:bg-slate-600/35";
  const disclosureAccent =
    cohort === "expert"
      ? "text-violet-400/85 hover:text-violet-300"
      : "text-slate-400/90 hover:text-slate-300";

  const d = data.data;

  return (
    <div
      className={`rounded-2xl border ${accentBorder} bg-gradient-to-b ${
        cohort === "expert" ? "from-violet-950/35" : "from-slate-900/40"
      } to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-black ${accentText} uppercase tracking-wide`}>토큰 인사이트 · 파도 B</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? (cohort === "expert" ? "오늘의 고수 1위 픽" : "오늘의 하수 1위 픽")}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{data.survey_date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InsightTokenPriceButton
            priceTokens={priceTokens}
            className={priceChipClass}
            locked={locked}
            unlocking={unlocking}
            onActivate={() => void handleUnlock()}
          />
          <span className="text-xl" aria-hidden>
            {locked ? "🔐" : "✨"}
          </span>
        </div>
      </div>
      <InsightAnimatedPreview slug={slug as InsightProductSlug} />
      <InsightDetailDisclosure accentSummaryClass={disclosureAccent}>
        <p>{META.hint}</p>
        {locked ? (
          <p className="text-gray-500">
            {data.description ?? `${cohort === "expert" ? "고수층" : "하수층"} 규격에서 그날 한 명의 방향 선택만 초성 형태와 함께 보여 줍니다.`}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {!locked && d ? (
        <>
          <p className="text-[10px] text-gray-500">{d.computed_note}</p>
          <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 space-y-2">
            <p className="text-[11px] text-gray-500">
              <span className="text-gray-400 font-bold">{d.rank_label_ko}</span> · 세그먼트 {d.segment_n}명
            </p>
            <p className="text-sm font-black text-white">
              <span className="text-gray-500 font-normal">{d.leader_masked_name}</span>
              <span className="mx-2 text-gray-600">·</span>
              <span className="tabular-nums">{d.leader_accuracy_pct}%</span>
            </p>
            <p className="text-base font-black text-white tracking-tight">{d.direction_label_ko}</p>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug pt-1">
            {(d.bullets ?? []).map((line) => (
              <li key={line.slice(0, 52)} className="flex gap-2">
                <span className={`${accentText} font-bold shrink-0`}>·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
