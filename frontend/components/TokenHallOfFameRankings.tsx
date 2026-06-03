"use client";

import { useEffect, useState } from "react";
import { getHallOfFameRankings, type HallOfFameRankings, type TokenRankingEntry } from "@/lib/api";

type Tab = "weekly" | "cumulative";

function RankingList({
  entries,
  scoreLabel,
  myRank,
  meId,
}: {
  entries: TokenRankingEntry[];
  scoreLabel: string;
  myRank: number | null;
  meId: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-gray-500 py-2">아직 실전 기록이 없어요.</p>;
  }

  return (
    <div className="space-y-1">
      {myRank != null ? (
        <p className="text-[11px] text-amber-200/90 mb-2">
          내 실전 순위 <span className="font-black tabular-nums">{myRank}</span>위
        </p>
      ) : meId ? (
        <p className="text-[11px] text-gray-500 mb-2">이번 주 실전 기록이 아직 없어요.</p>
      ) : null}
      <ol className="space-y-1.5">
        {entries.map((e) => {
          const mine = meId != null && e.user_id === meId;
          const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
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
                {e.score.toLocaleString()}
                <span className="ml-0.5 text-[10px] font-normal text-gray-500">{scoreLabel}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function TokenHallOfFameRankings({
  accessToken,
  meId,
}: {
  accessToken: string | null;
  meId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("weekly");
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

  const entries = tab === "weekly" ? data?.weekly ?? [] : data?.cumulative ?? [];
  const myRank = tab === "weekly" ? data?.my_weekly_rank : data?.my_cumulative_rank;

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/25 to-[#141414] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-amber-100">실력 랭킹</h2>
          {data ? (
            <p className="mt-0.5 text-[10px] text-gray-500">
              {tab === "weekly" ? (
                <>
                  주간 실전 · {data.week_start.slice(5).replace("-", "/")} ~{" "}
                  {data.week_end.slice(5).replace("-", "/")} (KST)
                </>
              ) : (
                <>누적 전력 · 현재 보유 기준</>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded-lg border border-[#333] bg-[#111] p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setTab("weekly")}
            className={`rounded-md px-2.5 py-1 font-bold transition-colors ${
              tab === "weekly" ? "bg-amber-600/40 text-amber-100" : "text-gray-500"
            }`}
            title="가입·이벤트 보상 제외, 설문 적중·배팅만"
          >
            주간 실전
          </button>
          <button
            type="button"
            onClick={() => setTab("cumulative")}
            className={`rounded-md px-2.5 py-1 font-bold transition-colors ${
              tab === "cumulative" ? "bg-amber-600/40 text-amber-100" : "text-gray-500"
            }`}
          >
            누적 전력
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-white/75">
        {tab === "weekly" ? (
          <>
            이번 주 <strong className="text-amber-200/95">설문 적중·배팅</strong>으로만 번 점수예요.
            가입·참여 보상 같은 기본 소득은 <strong className="text-white/90">넣지 않습니다</strong>.
          </>
        ) : (
          <>
            지금까지 쌓인 <strong className="text-amber-200/95">전투력</strong>(보유 토큰) 순위예요.
            실전·소통·적중이 모두 반영된 결과입니다.
          </>
        )}
      </p>

      {loading && !data ? (
        <p className="text-xs text-gray-500">실력 랭킹 불러오는 중…</p>
      ) : err ? (
        <p className="text-xs text-red-300/90">{err}</p>
      ) : (
        <RankingList
          entries={entries}
          scoreLabel={tab === "weekly" ? "실전pt" : "전력"}
          myRank={myRank ?? null}
          meId={meId}
        />
      )}
    </section>
  );
}
