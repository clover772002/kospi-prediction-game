"use client";

import { useEffect, useState } from "react";
import {
  getHallOfFameRankings,
  type HallOfFameRankingEntry,
  type HallOfFameRankings,
} from "@/lib/api";

type Tab = "weekly" | "cumulative";

function formatWeekRange(data: HallOfFameRankings): string {
  return `${data.week_start.slice(5).replace("-", "/")} ~ ${data.week_end.slice(5).replace("-", "/")} (KST)`;
}

function RankingList({
  entries,
  variant,
  myRank,
  meId,
}: {
  entries: HallOfFameRankingEntry[];
  variant: "token" | "accuracy";
  myRank: number | null;
  meId: string | null;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-2">
        {variant === "token" ? "아직 토큰 순위 데이터가 없어요." : "아직 적중률 순위 데이터가 없어요."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {myRank != null ? (
        <p className="text-[11px] text-amber-200/90 mb-2">
          내 순위 <span className="font-black tabular-nums">{myRank}</span>위
        </p>
      ) : meId ? (
        <p className="text-[11px] text-gray-500 mb-2">이번 목록에 내 기록이 없어요.</p>
      ) : null}
      <ol className="space-y-1.5">
        {entries.map((e) => {
          const mine = meId != null && e.user_id === meId;
          const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
          const scoreMain =
            variant === "accuracy" ? (
              <>
                {e.score}
                <span className="text-[10px] font-normal text-gray-500">%</span>
              </>
            ) : (
              e.score.toLocaleString()
            );
          const scoreSub =
            variant === "accuracy" && e.correct != null && e.total != null ? (
              <span className="ml-1 text-[10px] font-normal text-gray-500 tabular-nums">
                ({e.correct}/{e.total})
              </span>
            ) : variant === "token" ? (
              <span className="ml-0.5 text-[10px] font-normal text-gray-500">토큰</span>
            ) : null;

          return (
            <li
              key={e.user_id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                mine
                  ? "border-amber-400/35 bg-amber-500/10 text-white"
                  : "border-[#2A2A2A] bg-[#1A1A1A] text-gray-200"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 font-black tabular-nums text-gray-400">
                  {medal ?? e.rank}
                </span>
                <span className="truncate font-bold">{e.masked_name}</span>
                {mine ? (
                  <span className="shrink-0 text-[10px] text-amber-300/90">나</span>
                ) : null}
              </span>
              <span className="shrink-0 font-black tabular-nums text-amber-200">
                {scoreMain}
                {scoreSub}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RankBlock({
  title,
  variant,
  data,
  tab,
  onTabChange,
  entries,
  myRank,
  meId,
  loading,
  err,
}: {
  title: string;
  variant: "token" | "accuracy";
  data: HallOfFameRankings | null;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  entries: HallOfFameRankingEntry[];
  myRank: number | null;
  meId: string | null;
  loading: boolean;
  err: string | null;
}) {
  const borderClass =
    variant === "token"
      ? "border-amber-500/20 bg-gradient-to-b from-amber-950/25 to-[#141414]"
      : "border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-[#141414]";
  const titleClass = variant === "token" ? "text-amber-100" : "text-emerald-100";
  const activeTabClass =
    variant === "token" ? "bg-amber-600/40 text-amber-100" : "bg-emerald-600/40 text-emerald-100";

  const description =
    tab === "weekly"
      ? variant === "token"
        ? "이번 주 설문 적중·배팅으로만 번 토큰 합계예요(손실 포함). 가입·참여 보상 같은 기본 소득은 넣지 않습니다."
        : "이번 주 확정된 코스피 예측만 집계한 적중률이에요. 아직 결과가 없는 날은 빼고 계산합니다."
      : variant === "token"
        ? "현재 보유 토큰 순위예요. 설문·적중·소통·보상이 모두 반영된 잔액입니다."
        : "전체 기간 코스피 예측 적중률이에요. 참여 일수가 많을수록 같은 %라도 순위에서 유리합니다.";

  return (
    <section className={`mb-5 rounded-2xl border p-4 ${borderClass}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className={`text-sm font-black ${titleClass}`}>{title}</h2>
          {data ? (
            <p className="mt-0.5 text-[10px] text-gray-500">
              {tab === "weekly" ? `주간 · ${formatWeekRange(data)}` : "누적 · 전체 기간"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded-lg border border-[#333] bg-[#111] p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => onTabChange("weekly")}
            className={`rounded-md px-2.5 py-1 font-bold transition-colors ${
              tab === "weekly" ? activeTabClass : "text-gray-500"
            }`}
          >
            주간
          </button>
          <button
            type="button"
            onClick={() => onTabChange("cumulative")}
            className={`rounded-md px-2.5 py-1 font-bold transition-colors ${
              tab === "cumulative" ? activeTabClass : "text-gray-500"
            }`}
          >
            누적
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-white/75">{description}</p>

      {loading && !data ? (
        <p className="text-xs text-gray-500">불러오는 중…</p>
      ) : err ? (
        <p className="text-xs text-red-300/90">{err}</p>
      ) : (
        <RankingList entries={entries} variant={variant} myRank={myRank} meId={meId} />
      )}
    </section>
  );
}

export default function TokenHallOfFameRankings({
  accessToken,
  meId,
}: {
  accessToken: string | null;
  meId: string | null;
}) {
  const [tokenTab, setTokenTab] = useState<Tab>("weekly");
  const [accuracyTab, setAccuracyTab] = useState<Tab>("weekly");
  const [data, setData] = useState<HallOfFameRankings | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void getHallOfFameRankings(accessToken)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const tokenEntries =
    tokenTab === "weekly" ? data?.weekly ?? [] : data?.cumulative ?? [];
  const tokenMyRank =
    tokenTab === "weekly" ? data?.my_weekly_rank : data?.my_cumulative_rank;

  const accuracyEntries =
    accuracyTab === "weekly"
      ? data?.accuracy_weekly ?? []
      : data?.accuracy_cumulative ?? [];
  const accuracyMyRank =
    accuracyTab === "weekly"
      ? data?.my_accuracy_weekly_rank
      : data?.my_accuracy_cumulative_rank;

  return (
    <div className="mb-2">
      <RankBlock
        title="토큰 순위"
        variant="token"
        data={data}
        tab={tokenTab}
        onTabChange={setTokenTab}
        entries={tokenEntries}
        myRank={tokenMyRank ?? null}
        meId={meId}
        loading={loading}
        err={err}
      />
      <RankBlock
        title="적중률 순위"
        variant="accuracy"
        data={data}
        tab={accuracyTab}
        onTabChange={setAccuracyTab}
        entries={accuracyEntries}
        myRank={accuracyMyRank ?? null}
        meId={meId}
        loading={loading}
        err={err}
      />
    </div>
  );
}
