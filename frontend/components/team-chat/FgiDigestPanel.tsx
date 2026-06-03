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

/** 소통방 상단 — 공포·탐욕·인간지표 */
export default function FgiDigestPanel({ deferLoadMs = 0 }: { deferLoadMs?: number }) {
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
    if (deferLoadMs <= 0) {
      void load(false);
      return;
    }
    const id = window.setTimeout(() => void load(false), deferLoadMs);
    return () => window.clearTimeout(id);
  }, [load, deferLoadMs]);

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

  const panelId = "fgi-digest-panel-body";

  return (
    <section className="relative z-10 shrink-0 border-b border-violet-500/20 bg-[#0c0812]/90 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-base shrink-0" aria-hidden>
            📊
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-violet-100">공포·탐욕 지수</h2>
            {data?.as_of ? (
              <p className="text-xs font-bold text-gray-500 tabular-nums">{data.as_of} KST</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 py-1.5 text-xs font-bold text-violet-100 hover:bg-violet-500/25 active:scale-[0.98] transition-colors"
          >
            <svg
              className={`h-4 w-4 shrink-0 text-violet-200 transition-transform duration-200 ${
                open ? "rotate-0" : "-rotate-90"
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.52a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
            {open ? "접기" : "펼치기"}
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            className="rounded-lg border border-violet-500/30 px-2.5 py-1.5 text-xs font-bold text-violet-200/90 hover:bg-violet-500/10 disabled:opacity-40"
          >
            {refreshing ? "…" : "새로고침"}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={panelId}
          className="mt-2.5 space-y-3 rounded-xl border border-violet-500/15 bg-[#100a14]/80 px-3 py-3"
        >
          {loading && !data ? (
            <p className="text-sm text-gray-500 animate-pulse">지표 수집 중…</p>
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
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
