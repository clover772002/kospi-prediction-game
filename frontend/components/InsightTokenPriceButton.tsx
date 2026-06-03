"use client";

import { useInsightDashboardCompact } from "@/contexts/InsightDashboardCompactContext";

type Props = {
  priceTokens: number;
  className: string;
  locked: boolean;
  unlocking: boolean;
  onActivate: () => void;
};

/** 제목 옆에 붙는 `N 칩` 칩 — 잠금 중일 때 눌러 곧바로 결제 플로우(잠금 해제 요청). */
export default function InsightTokenPriceButton({ priceTokens, className, locked, unlocking, onActivate }: Props) {
  const compact = useInsightDashboardCompact();
  return (
    <button
      type="button"
      onClick={() => {
        if (locked && !unlocking) void onActivate();
      }}
      disabled={unlocking}
      aria-label={locked ? `${priceTokens} 칩 — 잠금 해제 요청` : `이미 열람됨(기준 ${priceTokens} 칩)`}
      className={`rounded-lg font-black tabular-nums border transition-all whitespace-nowrap ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]"
      } ${
        locked
          ? `${className} active:scale-[0.97] disabled:opacity-50`
          : `${className} opacity-50 cursor-default`
      }`}
    >
      {priceTokens} 칩
    </button>
  );
}
