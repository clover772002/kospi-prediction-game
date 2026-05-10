"use client";

import { useMemo, useEffect, useState } from "react";
import ExpertGapInsightCard from "@/components/ExpertGapInsightCard";
import RollingCrowdInsightCard from "@/components/RollingCrowdInsightCard";
import GroupVsGlobalInsightCard from "@/components/GroupVsGlobalInsightCard";
import TimeSliceAccuracyInsightCard from "@/components/TimeSliceAccuracyInsightCard";
import VoteTimeProfileInsightCard from "@/components/VoteTimeProfileInsightCard";
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
      <div className="rounded-xl border border-white/[0.08] bg-[#161616]/90 px-3 py-2.5">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">토큰 인사이트</p>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          고수·다수결 차이는 해당 날짜 집계가 있으면 열 수 있습니다. 「최근 7거래일」요약은{" "}
          <span className="text-gray-500">가장 최근 집계 기준일</span>을 종료 거래일로 잡습니다(주말이면 자동으로 직전 장일 기준으로 맞춤).
          무리 확신 분포는 같은 날 게이지 응답이 <span className="text-gray-500">20</span>
          명 이상일 때 열람됩니다. 그룹 vs 전체는 그날 해당 그룹 응답이 <span className="text-gray-500">8</span>
          명 이상일 때만 가능합니다. 시간대·세그먼트 인사이트(<span className="text-gray-500">responded_at</span>)는 시각 기록된 응답이{" "}
          <span className="text-gray-500">30</span>건 이상(세그먼트는 <span className="text-gray-500">15</span>
          명)일 때 안정적인 요약으로 열람됩니다. 내 확신도 vs 무리는 그날 본인이 설문한 경우에만 토큰 열람이 적용됩니다.
        </p>
      </div>

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
      <div className="rounded-xl border border-white/[0.08] bg-[#161616]/90 px-3 py-2.5 animate-pulse">
        <div className="h-3 w-24 rounded bg-[#333] mb-2" />
        <div className="h-14 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-56 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-slate-500/25 bg-slate-600/[0.08] px-4 py-4 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-44 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
      <div className="rounded-2xl border border-teal-500/25 bg-teal-500/[0.06] px-4 py-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#333] mb-2" />
        <div className="h-24 rounded bg-[#222]" />
      </div>
    </div>
  );
}
