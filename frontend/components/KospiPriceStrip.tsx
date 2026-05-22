"use client";

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
  const mins = kst.getHours() * 60 + kst.getMinutes();
  const isMarketOpen = mins >= 9 * 60 && mins < 15 * 60 + 35;

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
        <span className="text-sm text-gray-500">코스피 종가</span>
        <span
          className={`text-lg font-black ${up ? "text-market-up" : "text-market-down"}`}
        >
          {up ? "▲" : "▼"} {resultPct >= 0 ? "+" : ""}
          {resultPct.toFixed(2)}%
        </span>
      </div>
    );
  }

  if (live?.price) {
    const up = live.is_up ?? (live.change_pct ?? 0) >= 0;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 tabular-nums">
        <span className="text-sm text-gray-500">
          {isMarketOpen ? "코스피(장중)" : "코스피"}
        </span>
        <span className="text-lg font-black text-white">
          {live.price.toLocaleString()}
        </span>
        {live.change_pct !== null && live.change_pct !== undefined ? (
          <span
            className={`text-base font-bold ${up ? "text-market-up" : "text-market-down"}`}
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
