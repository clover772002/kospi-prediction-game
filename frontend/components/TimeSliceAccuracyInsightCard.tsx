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
  getTimeSliceAccuracyInsight,
  TimeSliceAccuracyInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("time_slice_accuracy");

interface Props {
  accessToken: string;
  surveyDate: string;
  onBalanceUpdated?: () => void;
  hideUnlockControl?: boolean;
}

/** 전역 최고 고수 1명의 최근 7거래일 제출 시각 버킷 분포 (responded_at 필요) */
export default function TimeSliceAccuracyInsightCard({
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
  const [data, setData] = useState<TimeSliceAccuracyInsightResponse | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await getTimeSliceAccuracyInsight(accessToken, surveyDate);
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
        product_slug: "time_slice_accuracy",
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
      <div className={`${d.cardRound} border border-amber-500/25 bg-amber-500/[0.06] ${d.cardPad} fade-up-2 animate-pulse`}>
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

  const reasonExplain = () => {
    switch (data.reason) {
      case "time_field_unavailable":
        return "DB에서 제출 시각(responded_at)을 불러오지 못했습니다. Supabase 마이그레이션 확인이 필요합니다.";
      case "no_survey_data":
        return "이 거래일에는 아직 설문 응답이 없습니다.";
      case "no_timestamp_data":
        return "최고 고수 후보가 해당 구간에 제출 시각이 기록된 응답을 남기지 않았습니다.";
      case "insufficient_total_timestamps":
        return "최고 고수 한 명이 최근 7거래일 구간에 남긴 시각 기록 응답이 최소 기준에 못 미칩니다.";
      case "segment_empty":
        return "예측 횟수 규격을 만족하는 고수 후보 무리가 없거나, 최고 적중자를 고를 수 없습니다.";
      default:
        return null;
    }
  };

  if (
    data.reason === "time_field_unavailable" ||
    data.reason === "no_survey_data" ||
    data.reason === "no_timestamp_data" ||
    data.reason === "insufficient_total_timestamps" ||
    data.reason === "segment_empty"
  ) {
    const body = reasonExplain();
    return (
      <InsightUnavailableCard variant="amber" slug="time_slice_accuracy" title={data.title ?? "최고 고수 응답 시간"} surveyDate={data.survey_date}>
        {body ? <p className="text-xs text-gray-400 leading-relaxed">{body}</p> : null}
      </InsightUnavailableCard>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div className={`${d.cardRound} border border-amber-500/35 bg-gradient-to-b from-amber-950/[0.35] to-[#141414]/90 ${d.cardPad} ${d.cardGap} fade-up-2`}>
      <InsightCardHeroGrid
        slug="time_slice_accuracy"
        headline={
          <>
            <p className={`${d.badge} font-black text-amber-300 uppercase tracking-wide`}>아이템</p>
            <p className={`${d.titleClass} text-white mt-0.5`}>{data.title ?? "최고 고수 최근 7일 응답 시간"}</p>
            <p className={`${d.subDate} text-gray-600 mt-0.5`}>{data.survey_date}</p>
          </>
        }
        tokenRow={
          <>
            {!hideUnlockControl ? (
              <InsightTokenPriceButton
                priceTokens={priceTokens}
                className="border-amber-500/45 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                locked={locked}
                unlocking={unlocking}
                onActivate={() => void handleUnlock()}
              />
            ) : locked ? (
              <span className="rounded-lg font-black tabular-nums border px-2.5 py-1 text-[11px] whitespace-nowrap border-amber-500/35 bg-amber-500/10 text-amber-200/80">
                {priceTokens} 토큰
              </span>
            ) : null}
            <span className={d.icon} aria-hidden>
              {locked ? "🔐" : "✨"}
            </span>
          </>
        }
      />
      <InsightDetailDisclosure accentSummaryClass="text-amber-400/85 hover:text-amber-300">
        <p>{META.hint}</p>
        {locked ? (
          <>
            <p className="text-gray-500">{data.description ?? "전역 최고 고수 한 명의 최근 7거래일 제출 시각 분포입니다."}</p>
            {hideUnlockControl ? <InsightUnlockShopHint /> : null}
          </>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className={`${d.computed} text-gray-500`}>{data.data?.computed_note}</p>
          {data.data?.leader_masked_name != null ? (
            <p className={`${d.computed} text-gray-400 tabular-nums`}>
              대상: <span className="text-gray-300 font-bold">{data.data.leader_masked_name}</span>
              {data.data.leader_accuracy_pct != null ? (
                <>
                  {" "}
                  · 누적 적중률 약 <span className="text-gray-300">{data.data.leader_accuracy_pct}%</span>
                </>
              ) : null}
              {" "}
              · 시각 기록 합산 {data.data?.total_with_timestamp ?? "–"}건
            </p>
          ) : (
            <p className={`${d.computed} text-gray-400 tabular-nums`}>시각 기록 합산 {data.data?.total_with_timestamp ?? "–"}건</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className={`w-full text-left tabular-nums ${d.tableWrap}`}>
              <thead className="text-gray-500 border-b border-white/[0.06]">
                <tr>
                  <th className={`${d.thPad} pl-2 pr-1 font-bold`}>버킷(KST)</th>
                  <th className={`${d.thPad} px-1 font-bold`}>n</th>
                  <th className={`${d.thPad} pr-2 font-bold`}>분포%</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(data.data?.buckets ?? []).map((row) => (
                  <tr key={row.bucket_id} className="border-b border-white/[0.04] last:border-0">
                    <td className={`${d.tdPad} pl-2 pr-1 text-gray-400`}>{row.label_ko}</td>
                    <td className={`${d.tdPad} px-1`}>{row.n}</td>
                    <td className={`${d.tdPad} pr-2`}>{row.sample_ok ? `${row.pct_of_timed_day}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`${d.list} text-gray-300 pt-1`}>
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 52)} className="flex gap-2">
                <span className="text-amber-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
