"use client";

import { createContext, useContext, type ReactNode } from "react";

const InsightDashboardCompactContext = createContext(false);

/** 대시보드 아이템 스택만 한눈에 보이게 카드·차트를 압축 */
export function InsightDashboardCompactProvider({ children }: { children: ReactNode }) {
  return <InsightDashboardCompactContext.Provider value={true}>{children}</InsightDashboardCompactContext.Provider>;
}

export function useInsightDashboardCompact() {
  return useContext(InsightDashboardCompactContext);
}
