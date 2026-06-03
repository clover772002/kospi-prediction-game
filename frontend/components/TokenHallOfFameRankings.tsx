"use client";

import { ChipAmount } from "@/components/ChipAmount";

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

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

/** 주간 칩 합계(순증감) — +120 / −46 */
function tokenWeeklyChipDisplay(score: number) {
  if (score > 0) {
    return (
      <ChipAmount amount={score} large sign="+" className="text-emerald-300" />
    );
  }
  if (score < 0) {
    return (
      <ChipAmount amount={Math.abs(score)} large sign="-" className="text-red-400" />
    );
  }
  return <ChipAmount amount={0} large sign="+" className="text-gray-400" />;
}

function RankingRow({
  entry,
  variant,
  highlight,
  tokenWeeklyDelta,
}: {
  entry: HallOfFameRankingEntry;
  variant: "token" | "accuracy";
  highlight?: boolean;
  /** 주간 칩 순위: 이번 주 순증감(+/−) 표기 */
  tokenWeeklyDelta?: boolean;
}) {
  const medal = rankMedal(entry.rank);
  const scoreMain =
    variant === "accuracy" ? (
      <>
        <span className="text-xl sm:text-2xl">{entry.score}</span>
        <span className="text-sm sm:text-base font-bold text-gray-500">%</span>
      </>
    ) : tokenWeeklyDelta ? (
      tokenWeeklyChipDisplay(entry.score)
    ) : (
      <ChipAmount amount={entry.score} large className="text-amber-200" />
    );
  const scoreSub =
    variant === "accuracy" && entry.correct != null && entry.total != null ? (
      <span className="ml-1.5 text-sm sm:text-base font-medium text-gray-500 tabular-nums">
        ({entry.correct}/{entry.total})
      </span>
    ) : null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${
        highlight
          ? "border-amber-400/35 bg-amber-500/10 text-white"
          : "border-[#2A2A2A] bg-[#1A1A1A] text-gray-200"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {medal ? (
          <span className="w-9 sm:w-10 shrink-0 text-center text-2xl sm:text-3xl leading-none" aria-hidden>
            {medal}
          </span>
        ) : (
          <span className="w-9 sm:w-10 shrink-0 text-center text-lg sm:text-xl font-black tabular-nums text-gray-400">
            {entry.rank}
          </span>
        )}
        <span className="truncate text-base sm:text-lg font-bold">{entry.masked_name}</span>
        {highlight ? (
          <span className="shrink-0 text-xs sm:text-sm font-bold text-amber-300/90">나</span>
        ) : null}
      </span>
      <span className="shrink-0 font-black tabular-nums text-amber-200 flex items-baseline">
        {scoreMain}
        {scoreSub}
      </span>
    </div>
  );
}

function RankingList({
  entries,
  variant,
  myEntry,
  meId,
  tokenWeeklyDelta,
}: {
  entries: HallOfFameRankingEntry[];
  variant: "token" | "accuracy";
  myEntry: HallOfFameRankingEntry | null | undefined;
  meId: string | null;
  tokenWeeklyDelta?: boolean;
}) {
  if (entries.length === 0 && !myEntry) {
    return (
      <p className="text-sm sm:text-base text-gray-500 py-2">
        {variant === "token" ? "아직 칩 순위 데이터가 없어요." : "아직 적중률 순위 데이터가 없어요."}
      </p>
    );
  }

  const myInTopList =
    meId != null && entries.some((e) => e.user_id === meId);

  return (
    <div className="space-y-3">
      {entries.length > 0 ? (
        <ol className="space-y-2" aria-label="상위 순위">
          {entries.map((e) => {
            const mine = meId != null && e.user_id === meId;
            return (
              <li key={e.user_id}>
                <RankingRow
                  entry={e}
                  variant={variant}
                  highlight={mine}
                  tokenWeeklyDelta={tokenWeeklyDelta}
                />
              </li>
            );
          })}
        </ol>
      ) : null}

      {meId && myEntry ? (
        <div
          className={`rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${
            variant === "accuracy"
              ? "border-emerald-500/25 bg-emerald-950/20"
              : "border-amber-500/25 bg-amber-950/20"
          }`}
        >
          <p
            className={`text-sm sm:text-base font-black mb-2.5 ${
              variant === "accuracy" ? "text-emerald-200/95" : "text-amber-200/95"
            }`}
          >
            내 순위
          </p>
          <RankingRow
            entry={myEntry}
            variant={variant}
            highlight={!myInTopList}
            tokenWeeklyDelta={tokenWeeklyDelta}
          />
        </div>
      ) : null}
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
  myEntry,
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
  myEntry: HallOfFameRankingEntry | null | undefined;
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
        ? "이번주 칩 증감량(+는 이득, -는 손실, 가입참여 보상은 제외)"
        : "이번주 코스피 방향 적중률"
      : variant === "token"
        ? "현재 보유 칩 순위예요. 설문·적중·소통·보상이 모두 반영된 잔액입니다."
        : "전체 기간 코스피 예측 적중률이에요. 참여 일수가 많을수록 같은 %라도 순위에서 유리합니다.";

  return (
    <section className={`mb-5 rounded-2xl border p-4 sm:p-5 ${borderClass}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className={`text-base sm:text-lg font-black ${titleClass}`}>{title}</h2>
          {data ? (
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              {tab === "weekly" ? `주간 · ${formatWeekRange(data)}` : "누적 · 전체 기간"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded-lg border border-[#333] bg-[#111] p-0.5 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => onTabChange("weekly")}
            className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
              tab === "weekly" ? activeTabClass : "text-gray-500"
            }`}
          >
            주간
          </button>
          <button
            type="button"
            onClick={() => onTabChange("cumulative")}
            className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
              tab === "cumulative" ? activeTabClass : "text-gray-500"
            }`}
          >
            누적
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm sm:text-base leading-relaxed text-white/80">{description}</p>

      {loading && !data ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : err ? (
        <p className="text-sm text-red-300/90">{err}</p>
      ) : (
        <RankingList
          entries={entries}
          variant={variant}
          myEntry={myEntry}
          meId={meId}
          tokenWeeklyDelta={variant === "token" && tab === "weekly"}
        />
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
  const tokenMyEntry =
    tokenTab === "weekly" ? data?.my_weekly_entry : data?.my_cumulative_entry;

  const accuracyEntries =
    accuracyTab === "weekly"
      ? data?.accuracy_weekly ?? []
      : data?.accuracy_cumulative ?? [];
  const accuracyMyEntry =
    accuracyTab === "weekly"
      ? data?.my_accuracy_weekly_entry
      : data?.my_accuracy_cumulative_entry;

  return (
    <div className="mb-2">
      <RankBlock
        title="칩 순위"
        variant="token"
        data={data}
        tab={tokenTab}
        onTabChange={setTokenTab}
        entries={tokenEntries}
        myEntry={tokenMyEntry}
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
        myEntry={accuracyMyEntry}
        meId={meId}
        loading={loading}
        err={err}
      />
    </div>
  );
}
