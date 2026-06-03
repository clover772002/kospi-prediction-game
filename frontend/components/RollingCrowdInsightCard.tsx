"use client";

import { ChipAmount } from "@/components/ChipAmount";
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
  hideUnlockControl?: boolean;
}

/** 최근 7거래일 전역 최고 고수 1명 적중 시계열 (칩 잠금) */
export default function RollingCrowdInsightCard({
  accessToken,
  surveyDateAsEndDate,
  onBalanceUpdated,
  hideUnlockControl = false,
}: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const d = useInsightDashLayout();
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
      <div className={`${d.cardRound} border border-sky-500/25 bg-sky-500/[0.06] ${d.cardPad} fade-up-2 animate-pulse`}>
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
        variant="sky"
        slug="rolling_crowd_summary"
        title={data.title ?? "고수의 7일간 적중률"}
        surveyDate={data.survey_date}
        surveyDatePrefix="종료 "
      >
        <p className="text-xs text-gray-400 leading-relaxed">
          이 종료 거래일을 끝으로 잡히는 최근 7거래일 구간에 최고 고수 적중 집계를 채울 데이터가 부족하거나 해당 구간 설문 이력이 없어요.
        </p>
      </InsightUnavailableCard>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  return (
    <div
      className={`${d.cardRound} border border-sky-500/35 bg-gradient-to-b from-sky-950/30 to-[#141414]/90 ${d.cardPad} ${d.cardGap} fade-up-2 ${
        d.c ? "" : "shadow-[0_0_28px_rgba(56,189,248,.08)]"
      }`}
    >
      <InsightCardHeroGrid
        slug="rolling_crowd_summary"
        headline={
          <>
            <p className={`${d.badge} font-black text-sky-300 uppercase tracking-wide`}>아이템</p>
            <p className={`${d.titleClass} text-white mt-0.5`}>{data.title ?? "고수의 7일간 적중률"}</p>
            <p className={`${d.subDate} text-gray-600 mt-0.5 tabular-nums`}>종료 {data.survey_date}</p>
          </>
        }
        tokenRow={
          <>
            {!hideUnlockControl ? (
              <InsightTokenPriceButton
                priceTokens={priceTokens}
                className="border-sky-500/45 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                locked={locked}
                unlocking={unlocking}
                onActivate={() => void handleUnlock()}
              />
            ) : locked ? (
              <span className="rounded-lg font-black tabular-nums border px-2.5 py-1 text-[11px] whitespace-nowrap border-sky-500/35 bg-sky-500/10 text-sky-200/80">
                <ChipAmount amount={priceTokens} />
              </span>
            ) : null}
            <span className={d.icon} aria-hidden>
              {locked ? "🔐" : "✨"}
            </span>
          </>
        }
      />
      <InsightDetailDisclosure accentSummaryClass="text-sky-400/85 hover:text-sky-300">
        <p>{META.hint}</p>
        {locked ? (
          <>
            <p className="text-gray-500">
              {data.description ??
                "종료 거래일 기준 최근 거래일 7일 동안 최고 고수가 참여한 날의 코스피 적중 여부(0%·100%)입니다."}
            </p>
            {hideUnlockControl ? <InsightUnlockShopHint /> : null}
          </>
        ) : null}
      </InsightDetailDisclosure>

      {!locked ? (
        <>
          <p className={`${d.computed} text-gray-500`}>{data.data?.computed_note}</p>
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className={`w-full text-left tabular-nums ${d.tableWrap}`}>
              <thead className="text-gray-500 border-b border-white/[0.06]">
                <tr>
                  <th className={`${d.thPad} pl-2 pr-1 font-bold`}>거래일</th>
                  <th className={`${d.thPad} px-1 font-bold`}>고수 n</th>
                  <th className={`${d.thPad} px-1 font-bold`}>결과</th>
                  <th className={`${d.thPad} pr-2 font-bold`}>적중률</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(data.data?.series ?? []).map((row, i) => (
                  <tr key={row.survey_date + i} className="border-b border-white/[0.04] last:border-0">
                    <td className={`${d.tdPad} pl-2 pr-1 text-gray-400`}>{row.survey_date.slice(5)}</td>
                    <td className={`${d.tdPad} px-1`}>{row.expert_n}</td>
                    <td className={`${d.tdPad} px-1`}>{row.result_known ? "확정" : "대기"}</td>
                    <td className={`${d.tdPad} pr-2`}>
                      {row.sample_ok && row.hit_rate_pct != null ? `${row.hit_rate_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`${d.list} text-gray-300 pt-1`}>
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 52)} className="flex gap-2">
                <span className="text-sky-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
