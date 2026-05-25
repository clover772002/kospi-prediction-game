"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getFgiDigest, type FgiDigestReading, type FgiDigestResponse } from "@/lib/api";

function zoneTone(zone: string): string {
  if (zone.includes("공포")) return "text-sky-300";
  if (zone.includes("탐욕")) return "text-amber-300";
  return "text-gray-300";
}

function ReadingRow({ r }: { r: FgiDigestReading }) {
  const head =
    r.score != null ? (
      <>
        <span className="font-bold text-white">{r.market_short}</span>
        <span className="text-gray-400">
          (
          <span className="tabular-nums text-white">{r.score_display}</span>,{" "}
          <span className={zoneTone(r.zone)}>{r.zone}</span>) {r.source}
        </span>
      </>
    ) : (
      <>
        <span className="font-bold text-white">{r.market_short}</span>
        <span className="text-gray-500"> (-) {r.source}</span>
      </>
    );

  return (
    <div className="space-y-0.5 text-sm leading-snug">
      <p>{head}</p>
      {r.url ? (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-300/90 underline underline-offset-2 break-all"
        >
          {r.source}
        </a>
      ) : null}
      {r.note ? <p className="text-xs text-gray-600">{r.note}</p> : null}
    </div>
  );
}

function humanVoteLine(human: FgiDigestResponse["human"]): ReactNode {
  const name = "코스피 투표";
  if (human.up_pct != null && human.down_pct != null) {
    const up = human.up_pct;
    const down = human.down_pct;
    const rise = up >= down;
    return (
      <>
        {name}(
        <span className={rise ? "text-market-up font-bold" : "text-market-down font-bold"}>
          {rise ? `상승 ${up}` : `하락 ${down}`}%
        </span>
        ) · {human.phase} {human.total}명
      </>
    );
  }
  return (
    <>
      {name}(-) · {human.phase} · 응답 {human.total}명
    </>
  );
}

/** 소통방 상단 — 텔레그램 「공포」와 동일 지표 */
export default function FgiDigestPanel() {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<FgiDigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setErr(null);
    try {
      const d = await getFgiDigest();
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void load(true);
    };
    const id = window.setInterval(tick, 300_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return (
    <section className="relative z-10 shrink-0 border-b border-violet-500/20 bg-[#0c0812]/90 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-base shrink-0" aria-hidden>
            📊
          </span>
          <span className="min-w-0 truncate text-sm font-black text-violet-100">
            공포·탐욕 지수
            {data?.as_of ? (
              <span className="ml-1.5 text-xs font-bold text-gray-500">{data.as_of} KST</span>
            ) : null}
          </span>
          <span className="text-gray-500 text-xs shrink-0">{open ? "▾" : "▸"}</span>
        </button>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="shrink-0 rounded-lg border border-violet-500/30 px-2.5 py-1 text-xs font-bold text-violet-200/90 disabled:opacity-40"
        >
          {refreshing ? "…" : "새로고침"}
        </button>
      </div>

      {open ? (
        <div className="mt-2.5 space-y-3 rounded-xl border border-violet-500/15 bg-[#100a14]/80 px-3 py-3">
          {loading && !data ? (
            <p className="text-sm text-gray-500 animate-pulse">지표 수집 중… (텔레그램과 동일 소스)</p>
          ) : null}
          {err ? (
            <p className="text-sm text-rose-300/90">
              {err}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void load(false)}
              >
                다시 시도
              </button>
            </p>
          ) : null}
          {data ? (
            <>
              <div>
                <p className="text-xs font-black text-gray-400 mb-2">🤖 시장 지표</p>
                <div className="space-y-3">
                  {data.readings_kospi.map((r, i) => (
                    <ReadingRow key={`k-${r.source}-${i}`} r={r} />
                  ))}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
                    <p className="text-sm text-gray-200">{humanVoteLine(data.human)}</p>
                    <Link
                      href="/survey"
                      className="mt-1 inline-block text-xs text-amber-300/90 underline underline-offset-2"
                    >
                      설문 참여하기
                    </Link>
                  </div>
                  {data.readings_other.map((r, i) => (
                    <ReadingRow key={`o-${r.market_short}-${r.source}-${i}`} r={r} />
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-600 leading-relaxed">
                텔레그램 봇에 「공포」 또는 「지수」를 내면 같은 내용을 받을 수 있어요.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
