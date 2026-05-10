"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
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
}

/** 파도 B — 시간대별 응답·적중 무드(KST 버킷, responded_at 필요) */
export default function TimeSliceAccuracyInsightCard({ accessToken, surveyDate, onBalanceUpdated }: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
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
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
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

  const reasonExplain = () => {
    switch (data.reason) {
      case "time_field_unavailable":
        return "DB에서 제출 시각(responded_at)을 불러오지 못했습니다. Supabase 마이그레이션 확인이 필요합니다.";
      case "no_survey_data":
        return "이 거래일에는 아직 설문 응답이 없습니다.";
      case "no_timestamp_data":
        return "응답은 있지만 제출 시각이 기록된 건이 없습니다.";
      case "insufficient_total_timestamps":
        return "시각이 기록된 응답이 아직 적어 카드를 통계적으로 열 수 없습니다(플랜: 최소 30건 전후).";
      default:
        return null;
    }
  };

  if (
    data.reason === "time_field_unavailable" ||
    data.reason === "no_survey_data" ||
    data.reason === "no_timestamp_data" ||
    data.reason === "insufficient_total_timestamps"
  ) {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">{reasonExplain()}</p>
        <p className="text-[10px] text-gray-600 tabular-nums">{data.survey_date}</p>
      </div>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-950/[0.35] to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-amber-300 uppercase tracking-wide">토큰 인사이트 · 파도 B</p>
          <p className="text-sm font-black text-white mt-0.5">{data.title ?? "시간대별 무드"}</p>
          <InsightAnimatedPreview slug="time_slice_accuracy" />
          <p className="text-[10px] text-gray-600 mt-0.5">{data.survey_date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InsightTokenPriceButton
            priceTokens={priceTokens}
            className="border-amber-500/45 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
            locked={locked}
            unlocking={unlocking}
            onActivate={() => void handleUnlock()}
          />
          <span className="text-xl" aria-hidden>
            {locked ? "🔐" : "✨"}
          </span>
        </div>
      </div>
      <InsightDetailDisclosure accentSummaryClass="text-amber-400/85 hover:text-amber-300">
        <p>{META.hint}</p>
        {locked ? (
          <p className="text-gray-500">
            {data.description ?? "그날 투표가 몰린 KST 시간대와, 결과 확정 후에는 버킷별 적중 스냅샷까지 보여 줍니다."}
          </p>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <p className="text-[10px] text-gray-500">
            결과 확정 여부: {data.data?.kospi_result_known ? "코스피 결과 반영 가능" : "분포만(결과 미확정)"} · 시각 기록 건수{" "}
            {data.data?.total_with_timestamp ?? "–"}
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="w-full text-[10px] text-left tabular-nums">
              <thead className="text-gray-500 border-b border-white/[0.06]">
                <tr>
                  <th className="py-2 pl-2 pr-1 font-bold">버킷(KST)</th>
                  <th className="py-2 px-1 font-bold">n</th>
                  <th className="py-2 px-1 font-bold">분포%</th>
                  <th className="py-2 pr-2 font-bold">적중%</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(data.data?.buckets ?? []).map((row) => (
                  <tr key={row.bucket_id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-1.5 pl-2 pr-1 text-gray-400">{row.label_ko}</td>
                    <td className="py-1.5 px-1">{row.n}</td>
                    <td className="py-1.5 px-1">{row.sample_ok ? `${row.pct_of_timed_day}%` : "—"}</td>
                    <td className="py-1.5 pr-2">
                      {data.data?.kospi_result_known && row.sample_ok && row.correct_pct_snapshot != null
                        ? `${row.correct_pct_snapshot}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug pt-1">
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
