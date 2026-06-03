"use client";

import { isKospiMarketSessionOpenKST } from "@/lib/kospi-market-hours";
import { surveyUi } from "@/lib/survey-ui-tokens";

export type KospiLiveQuoteData = {
  price: number | null;
  change_pct: number | null;
  is_up: boolean | null;
};

/** 결과 미확정 행 옆 인라인 시세 */
export function KospiLiveQuote({ live }: { live: KospiLiveQuoteData }) {
  if (!isKospiMarketSessionOpenKST() || live.price == null) return null;
  const up = live.is_up ?? (live.change_pct ?? 0) >= 0;

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 tabular-nums">
      <span className="text-xs sm:text-sm text-gray-500">코스피(장중)</span>
      <span className="text-sm sm:text-base font-black text-white">{live.price.toLocaleString()}</span>
      {live.change_pct !== null && live.change_pct !== undefined ? (
        <span className={`text-sm sm:text-base font-bold ${up ? "text-market-up" : "text-market-down"}`}>
          {up ? "+" : ""}
          {live.change_pct.toFixed(2)}%
        </span>
      ) : null}
    </span>
  );
}

/** 설문 상단 — 코스피 종가·등락률 숫자만 (차트·OHLC 없음) */
export default function KospiPriceStrip({
  status,
  resultPct = null,
  resultUp = null,
  live = null,
}: {
  status: string;
  resultPct?: number | null;
  resultUp?: boolean | null;
  live?: {
    price: number | null;
    change_pct: number | null;
    is_up: boolean | null;
  } | null;
}) {
  const kst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const isMarketOpen = isKospiMarketSessionOpenKST(kst);

  if (
    (status === "result" || status === "closed") &&
    resultUp !== null &&
    resultUp !== undefined &&
    resultPct !== null &&
    resultPct !== undefined
  ) {
    const up = resultUp;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 tabular-nums">
        <span className={surveyUi.cardMeta}>코스피 종가</span>
        <span
          className={`${surveyUi.numEmphasis} ${up ? "text-market-up" : "text-market-down"}`}
        >
          {up ? "▲" : "▼"} {resultPct >= 0 ? "+" : ""}
          {resultPct.toFixed(2)}%
        </span>
      </div>
    );
  }

  if (isMarketOpen && live?.price) {
    const up = live.is_up ?? (live.change_pct ?? 0) >= 0;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 tabular-nums">
        <span className={surveyUi.cardMeta}>코스피(장중)</span>
        <span className={`${surveyUi.numEmphasis} text-white`}>
          {live.price.toLocaleString()}
        </span>
        {live.change_pct !== null && live.change_pct !== undefined ? (
          <span
            className={`${surveyUi.body} ${up ? "text-market-up" : "text-market-down"}`}
          >
            {up ? "+" : ""}
            {live.change_pct.toFixed(2)}%
          </span>
        ) : null}
      </div>
    );
  }

  return null;
}
