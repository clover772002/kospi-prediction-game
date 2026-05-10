"use client";

import { useMemo } from "react";
import { useInsightDashboardCompact } from "@/contexts/InsightDashboardCompactContext";

/** 대시보드에서만 true — 카드·표·글자 크기를 대폭 줄임(약 1/2 선형 ≈ 면적 1/4 느낌) */
export function useInsightDashLayout() {
  const c = useInsightDashboardCompact();
  return useMemo(
    () => ({
      c,
      cardRound: c ? "rounded-lg" : "rounded-2xl",
      cardPad: c ? "px-2 py-1.5" : "px-4 py-4",
      cardGap: c ? "space-y-1" : "space-y-3",
      rowGap: c ? "gap-1" : "gap-2",
      badge: c ? "text-[8px]" : "text-[10px]",
      titleClass: c ? "text-xs font-black" : "text-sm font-black",
      subDate: c ? "text-[9px]" : "text-[10px]",
      icon: c ? "text-sm leading-none" : "text-xl",
      meta: c ? "text-[9px]" : "text-[10px]",
      list: c ? "space-y-0.5 text-[9px] leading-snug" : "space-y-2 text-[11px] leading-snug",
      computed: c ? "text-[9px]" : "text-[10px]",
      tableWrap: c ? "text-[8px]" : "text-[10px]",
      thPad: c ? "py-0.5" : "py-2",
      tdPad: c ? "py-0.5" : "py-1.5",
      dash: c ? "gap-2 text-[9px]" : "gap-4 text-[10px]",
    }),
    [c],
  );
}
