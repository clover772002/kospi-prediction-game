"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import ExpertGapInsightCard from "@/components/ExpertGapInsightCard";
import RollingCrowdInsightCard from "@/components/RollingCrowdInsightCard";
import TimeSliceAccuracyInsightCard from "@/components/TimeSliceAccuracyInsightCard";
import VoteTimeProfileInsightCard from "@/components/VoteTimeProfileInsightCard";
import CohortLeaderPickInsightCard from "@/components/CohortLeaderPickInsightCard";
import CrowdConvictionInsightCard from "@/components/CrowdConvictionInsightCard";
import InsightPreviewStack from "@/components/InsightPreviewStack";
import { INSIGHT_PRODUCTS_PREVIEW_ONLY } from "@/lib/insight_items_config";

/** 뷰포트 근처에 올 때만 자식 마운트 → 인사이트 API 동시 요청 완화 */
export function InsightsInView({
  fallback,
  rootMargin = "280px 0px 320px 0px",
  /** true면 상점 등에서 스크롤 없이 곧바로 카드 마운트(API 요청) */
  eager = false,
  children,
}: {
  fallback: ReactNode;
  rootMargin?: string;
  eager?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(eager);

  useEffect(() => {
    if (eager) {
      setShow(true);
      return;
    }
    if (show) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, show, rootMargin]);

  return <div ref={ref}>{show ? children : fallback}</div>;
}

function StaggerMount({ index, children }: { index: number; children: ReactNode }) {
  const [ok, setOk] = useState(index === 0);
  useEffect(() => {
    if (index === 0) return;
    const ms = index * 85;
    const t = window.setTimeout(() => setOk(true), ms);
    return () => clearTimeout(t);
  }, [index]);

  if (!ok) {
    return (
      <div className="h-[4.5rem] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" aria-hidden />
    );
  }
  return <>{children}</>;
}

/** 대시보드·상점 공통: 동일 거래일 기준 8종 인사이트 카드 */
export default function InsightCardsStack({
  accessToken,
  surveyDate,
  hideUnlockControl = false,
  onBalanceUpdated,
}: {
  accessToken: string;
  surveyDate: string;
  hideUnlockControl?: boolean;
  onBalanceUpdated?: () => void;
}) {
  if (INSIGHT_PRODUCTS_PREVIEW_ONLY) {
    return <InsightPreviewStack surveyDate={surveyDate} />;
  }

  return (
    <div className="space-y-1">
      <StaggerMount index={0}>
        <ExpertGapInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={1}>
        <RollingCrowdInsightCard
          accessToken={accessToken}
          surveyDateAsEndDate={surveyDate}
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={2}>
        <TimeSliceAccuracyInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={3}>
        <VoteTimeProfileInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          cohort="expert"
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={4}>
        <VoteTimeProfileInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          cohort="novice"
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={5}>
        <CohortLeaderPickInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          cohort="expert"
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={6}>
        <CohortLeaderPickInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          cohort="novice"
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
      <StaggerMount index={7}>
        <CrowdConvictionInsightCard
          accessToken={accessToken}
          surveyDate={surveyDate}
          hideUnlockControl={hideUnlockControl}
          onBalanceUpdated={onBalanceUpdated}
        />
      </StaggerMount>
    </div>
  );
}

export function InsightCardsStackSkeleton() {
  const slot = (border: string, bg: string) => (
    <div className={`rounded-lg border ${border} ${bg} px-2 py-2 animate-pulse`}>
      <div className="h-2 w-40 rounded bg-[#333] mb-1" />
      <div className="h-9 rounded bg-[#222]" />
    </div>
  );
  return (
    <div className="space-y-1">
      {slot("border-violet-500/25", "bg-violet-500/[0.06]")}
      {slot("border-sky-500/25", "bg-sky-500/[0.06]")}
      {slot("border-amber-500/25", "bg-amber-500/[0.06]")}
      {slot("border-indigo-500/25", "bg-indigo-500/[0.06]")}
      {slot("border-slate-500/25", "bg-slate-600/[0.08]")}
      {slot("border-fuchsia-500/25", "bg-fuchsia-500/[0.06]")}
      {slot("border-zinc-500/25", "bg-zinc-600/[0.08]")}
      {slot("border-rose-500/25", "bg-rose-500/[0.06]")}
    </div>
  );
}
