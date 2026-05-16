"use client";

import { useMemo, useEffect, useState, useRef, type ReactNode } from "react";
import ExpertGapInsightCard from "@/components/ExpertGapInsightCard";
import RollingCrowdInsightCard from "@/components/RollingCrowdInsightCard";
import TimeSliceAccuracyInsightCard from "@/components/TimeSliceAccuracyInsightCard";
import VoteTimeProfileInsightCard from "@/components/VoteTimeProfileInsightCard";
import CohortLeaderPickInsightCard from "@/components/CohortLeaderPickInsightCard";
import CrowdConvictionInsightCard from "@/components/CrowdConvictionInsightCard";
import { InsightDashboardCompactProvider } from "@/contexts/InsightDashboardCompactContext";
import type { DashboardData, TodaySurvey } from "@/lib/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function uniqueSortedDesc(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
}

/** 뷰포트 근처에 올 때만 자식 마운트 → 인사이트 API 8개 동시 폭주 방지 */
function InsightsInView({
  fallback,
  rootMargin = "280px 0px 320px 0px",
  children,
}: {
  fallback: ReactNode;
  rootMargin?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
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
  }, [show, rootMargin]);

  return <div ref={ref}>{show ? children : fallback}</div>;
}

/** 카드별 API 시작 시점 분산 (서버·브라우저 동시 부하 완화) */
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

export default function DashboardInsightSection({
  accessToken,
  today,
  dash,
  onBalanceUpdated,
}: {
  accessToken: string;
  today: TodaySurvey | null;
  dash: DashboardData | null;
  onBalanceUpdated?: () => void;
}) {
  const [recentResultDates, setRecentResultDates] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/public/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { history?: Array<{ date?: string }> }) => {
        const dates = (j.history ?? [])
          .map((row) => row.date)
          .filter((d): d is string => typeof d === "string" && DATE_RE.test(d));
        if (alive) setRecentResultDates(dates);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const isWeekendKST = useMemo(() => {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kst.getDay();
    return day === 0 || day === 6;
  }, []);

  const canIncludeTodaySurvey = !!(
    today &&
    !isWeekendKST &&
    (today.status === "open" || today.status === "closed" || today.status === "result") &&
    today.survey_date
  );

  const insightDateOptions = useMemo(() => {
    const fromHistory = (dash?.history ?? []).map((h) => h.date).filter(Boolean);
    const extras: string[] = [];
    if (canIncludeTodaySurvey && today?.survey_date) extras.push(today.survey_date);
    return uniqueSortedDesc([...recentResultDates, ...fromHistory, ...extras]);
  }, [dash?.history, recentResultDates, canIncludeTodaySurvey, today?.survey_date]);

  const surveyDate = useMemo(
    () => (insightDateOptions.length ? insightDateOptions[0] : null),
    [insightDateOptions],
  );

  if (!surveyDate) return null;

  return (
    <InsightDashboardCompactProvider>
      <InsightsInView fallback={<DashboardInsightSectionSkeleton />}>
        <div className="space-y-1">
          <StaggerMount index={0}>
            <ExpertGapInsightCard accessToken={accessToken} surveyDate={surveyDate} onBalanceUpdated={onBalanceUpdated} />
          </StaggerMount>
          <StaggerMount index={1}>
            <RollingCrowdInsightCard
              accessToken={accessToken}
              surveyDateAsEndDate={surveyDate}
              onBalanceUpdated={onBalanceUpdated}
            />
          </StaggerMount>
          <StaggerMount index={2}>
            <TimeSliceAccuracyInsightCard
              accessToken={accessToken}
              surveyDate={surveyDate}
              onBalanceUpdated={onBalanceUpdated}
            />
          </StaggerMount>
          <StaggerMount index={3}>
            <VoteTimeProfileInsightCard
              accessToken={accessToken}
              surveyDate={surveyDate}
              cohort="expert"
              onBalanceUpdated={onBalanceUpdated}
            />
          </StaggerMount>
          <StaggerMount index={4}>
            <VoteTimeProfileInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="novice" onBalanceUpdated={onBalanceUpdated} />
          </StaggerMount>
          <StaggerMount index={5}>
            <CohortLeaderPickInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="expert" onBalanceUpdated={onBalanceUpdated} />
          </StaggerMount>
          <StaggerMount index={6}>
            <CohortLeaderPickInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="novice" onBalanceUpdated={onBalanceUpdated} />
          </StaggerMount>
          <StaggerMount index={7}>
            <CrowdConvictionInsightCard accessToken={accessToken} surveyDate={surveyDate} onBalanceUpdated={onBalanceUpdated} />
          </StaggerMount>
        </div>
      </InsightsInView>
    </InsightDashboardCompactProvider>
  );
}

export function DashboardInsightSectionSkeleton() {
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
