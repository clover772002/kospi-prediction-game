"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightCardHeroGrid from "@/components/InsightCardHeroGrid";
import InsightUnavailableCard from "@/components/InsightUnavailableCard";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta, type InsightProductSlug } from "@/lib/insight_card_meta";
import { useInsightDashLayout } from "@/hooks/useInsightDashLayout";
import {
  getExpertVoteTimeProfileInsight,
  getNoviceVoteTimeProfileInsight,
  VoteTimeProfileInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

interface Props {
  accessToken: string;
  surveyDate: string;
  cohort: "expert" | "novice";
  onBalanceUpdated?: () => void;
}

/** 고수층 또는 하수층 투표 시간 분포(파도 B) */

export default function VoteTimeProfileInsightCard({ accessToken, surveyDate, cohort, onBalanceUpdated }: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const ix = useInsightDashLayout();
  const slug = cohort === "expert" ? "expert_vote_time_profile" : "novice_vote_time_profile";
  const META = useMemo(() => insightMeta(slug as InsightProductSlug), [slug]);

  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<VoteTimeProfileInsightResponse | null>(null);


  const accentBorder = cohort === "expert" ? "border-indigo-500/35" : "border-slate-500/35";
  const accentText = cohort === "expert" ? "text-indigo-300" : "text-slate-300";

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r =
        cohort === "expert"
          ? await getExpertVoteTimeProfileInsight(accessToken, surveyDate)
          : await getNoviceVoteTimeProfileInsight(accessToken, surveyDate);
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
        className={`${ix.cardRound} border ${ix.cardPad} fade-up-2 animate-pulse ${
          cohort === "expert" ? "border-indigo-500/25 bg-indigo-500/[0.06]" : "border-slate-500/25 bg-slate-500/[0.06]"
        }`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,40%)] gap-2 items-stretch min-h-[120px]">
          <div className="flex flex-col justify-between gap-2">
            <div className="space-y-1.5">
              <div className={`${ix.c ? "h-2 w-36" : "h-3 w-44"} rounded bg-[#333]`} />
              <div className={`${ix.c ? "h-4 w-full max-w-[10rem]" : "h-5 w-full max-w-[14rem]"} rounded bg-[#2a2a2a]`} />
            </div>
            <div className={`${ix.c ? "h-6 w-24" : "h-8 w-32"} rounded bg-[#333]`} />
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a]/80 min-h-[100px]" />
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

  const softReason = () => {
    switch (data.reason) {
      case "time_field_unavailable":
        return "제출 시각 컬럼을 사용할 수 없습니다. DB 마이그레이션을 확인해 주세요.";
      case "no_survey_data":
        return "이 거래일에는 설문 응답이 없습니다.";
      case "segment_empty":
        return "고수/하수층을 나눌 만한 자격 응답자가 아직 부족합니다.";
      case "insufficient_total_timestamps":
        return "시각이 기록된 전체 응답이 최소 기준(30건)에 못 미칩니다.";
      case "insufficient_segment_timestamps":
        return "세그먼트(고수/하수) 쪽 시각 기록 응답이 최소 기준(15건)에 못 미칩니다.";
      default:
        return null;
    }
  };

  if (
    data.reason === "time_field_unavailable" ||
    data.reason === "no_survey_data" ||
    data.reason === "segment_empty" ||
    data.reason === "insufficient_total_timestamps" ||
    data.reason === "insufficient_segment_timestamps"
  ) {
    const body = softReason();
    const v = cohort === "expert" ? "indigo" : "slate";
    const defaultTitle = cohort === "expert" ? "고수 시간" : "하수 시간";
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
      ? "border-indigo-500/45 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25"
      : "border-slate-500/45 bg-slate-600/20 text-slate-100 hover:bg-slate-600/35";
  const disclosureAccent =
    cohort === "expert"
      ? "text-indigo-400/85 hover:text-indigo-300"
      : "text-slate-400/90 hover:text-slate-300";

  return (
    <div
      className={`${ix.cardRound} border ${accentBorder} bg-gradient-to-b ${
        cohort === "expert" ? "from-indigo-950/30" : "from-slate-900/40"
      } to-[#141414]/90 ${ix.cardPad} ${ix.cardGap} fade-up-2`}
    >
      <InsightCardHeroGrid
        slug={slug as InsightProductSlug}
        headline={
          <>
            <p className={`${ix.badge} font-black ${accentText} uppercase tracking-wide`}>토큰 인사이트 · 파도 B</p>
            <p className={`${ix.titleClass} text-white mt-0.5`}>{data.title ?? (cohort === "expert" ? "고수 시간" : "하수 시간")}</p>
            <p className={`${ix.subDate} text-gray-600 mt-0.5`}>{data.survey_date}</p>
          </>
        }
        tokenRow={
          <>
            <InsightTokenPriceButton
              priceTokens={priceTokens}
              className={priceChipClass}
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
      <InsightDetailDisclosure accentSummaryClass={disclosureAccent}>
        <p>{META.hint}</p>
        {locked ? (
          <p className="text-gray-500">
            {data.description ??
              `${cohort === "expert" ? "고수층" : "하수층"} 투표가 몰린 KST 시간대를 전체와 비교한 요약입니다.`}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className={`${ix.computed} text-gray-500`}>{data.data?.computed_note}</p>
          <p className={`${ix.computed} text-gray-400 tabular-nums`}>
            {data.data?.segment_label_ko} 시각기록 {data.data?.segment_with_timestamp_n ?? "–"}명 · 전체 시각기록{" "}
            {data.data?.global_with_timestamp_n ?? "–"}명
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className={`w-full text-left tabular-nums ${ix.tableWrap}`}>
              <thead className="text-gray-500 border-b border-white/[0.06]">
                <tr>
                  <th className={`${ix.thPad} pl-2 pr-1 font-bold`}>버킷</th>
                  <th className={`${ix.thPad} px-1 font-bold`}>세그%</th>
                  <th className={`${ix.thPad} pr-2 font-bold`}>전체%</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(data.data?.buckets ?? []).map((row) => (
                  <tr key={row.bucket_id} className="border-b border-white/[0.04] last:border-0">
                    <td className={`${ix.tdPad} pl-2 pr-1 text-gray-400`}>{row.label_ko}</td>
                    <td className={`${ix.tdPad} px-1`}>{row.segment_share_pct}%</td>
                    <td className={`${ix.tdPad} pr-2`}>{row.global_share_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`${ix.list} text-gray-300 pt-1`}>
            {(data.data?.bullets ?? []).map((line) => (
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
