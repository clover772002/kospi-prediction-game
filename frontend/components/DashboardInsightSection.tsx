"use client";

import { useMemo, useEffect, useState } from "react";
import ExpertGapInsightCard from "@/components/ExpertGapInsightCard";
import RollingCrowdInsightCard from "@/components/RollingCrowdInsightCard";
import GroupVsGlobalInsightCard from "@/components/GroupVsGlobalInsightCard";
import TimeSliceAccuracyInsightCard from "@/components/TimeSliceAccuracyInsightCard";
import VoteTimeProfileInsightCard from "@/components/VoteTimeProfileInsightCard";
import CohortLeaderPickInsightCard from "@/components/CohortLeaderPickInsightCard";
import CrowdConvictionInsightCard from "@/components/CrowdConvictionInsightCard";
import GaugeCrowdInsightCard from "@/components/GaugeCrowdInsightCard";
import type { DashboardData, TodaySurvey, Group } from "@/lib/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function uniqueSortedDesc(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
}

export default function DashboardInsightSection({
  accessToken,
  today,
  dash,
  groups = [],
  onBalanceUpdated,
}: {
  accessToken: string;
  today: TodaySurvey | null;
  dash: DashboardData | null;
  groups?: Group[];
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
    <div className="space-y-3">
      <ExpertGapInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        onBalanceUpdated={onBalanceUpdated}
      />
      <RollingCrowdInsightCard
        accessToken={accessToken}
        surveyDateAsEndDate={surveyDate}
        onBalanceUpdated={onBalanceUpdated}
      />
      <GroupVsGlobalInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        groups={groups ?? []}
        onBalanceUpdated={onBalanceUpdated}
      />
      <TimeSliceAccuracyInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        onBalanceUpdated={onBalanceUpdated}
      />
      <VoteTimeProfileInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        cohort="expert"
        onBalanceUpdated={onBalanceUpdated}
      />
      <VoteTimeProfileInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="novice" onBalanceUpdated={onBalanceUpdated} />
      <CohortLeaderPickInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="expert" onBalanceUpdated={onBalanceUpdated} />
      <CohortLeaderPickInsightCard accessToken={accessToken} surveyDate={surveyDate} cohort="novice" onBalanceUpdated={onBalanceUpdated} />
      <CrowdConvictionInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        onBalanceUpdated={onBalanceUpdated}
      />
      <GaugeCrowdInsightCard
        accessToken={accessToken}
        surveyDate={surveyDate}
        onBalanceUpdated={onBalanceUpdated}
      />
    </div>
  );
}

export function DashboardInsightSectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-56 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-slate-500/25 bg-slate-600/[0.08] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-56 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-zinc-500/25 bg-zinc-600/[0.08] px-4 py-4 animate-pulse">
        <div className="h-4 w-56 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-44 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#333] mb-2" />
        <div className="h-36 rounded-lg bg-[#222]" />
      </div>
    </div>
  );
}
