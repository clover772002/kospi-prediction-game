"use client";

import { useEffect, useState } from "react";
import {
  ACCURACY_MODE,
  SURVIVAL_MODE,
  TOURNAMENT_MODE_STORAGE_KEY,
  type TournamentMode,
} from "@/lib/tournament-copy";

const MODES = [SURVIVAL_MODE, ACCURACY_MODE] as const;

type Props = {
  selected: TournamentMode;
  onSelect: (mode: TournamentMode) => void;
};

export default function TournamentModeLanding({ selected, onSelect }: Props) {
  const [survivors, setSurvivors] = useState(87);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSurvivors((n) => (n <= 12 ? 87 : n - 11));
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODES.map((mode) => {
          const active = selected === mode.id;
          const isSurvival = mode.id === "survival";

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                onSelect(mode.id);
                try {
                  localStorage.setItem(TOURNAMENT_MODE_STORAGE_KEY, mode.id);
                } catch {
                  /* ignore */
                }
              }}
              className={`relative text-left rounded-3xl border-2 p-5 sm:p-6 transition-all duration-200 active:scale-[0.99] ${
                isSurvival
                  ? active
                    ? "border-orange-500/70 bg-gradient-to-b from-[#1a1008]/95 to-[#121212]/90 shadow-[0_0_28px_rgba(249,115,22,0.18)]"
                    : "border-orange-500/25 bg-gradient-to-b from-[#141008]/80 to-[#101010]/90 hover:border-orange-500/45"
                  : active
                    ? "border-emerald-500/70 bg-gradient-to-b from-[#081510]/95 to-[#121212]/90 shadow-[0_0_28px_rgba(16,185,129,0.18)]"
                    : "border-emerald-500/25 bg-gradient-to-b from-[#081210]/80 to-[#101010]/90 hover:border-emerald-500/45"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-3xl" aria-hidden>
                  {mode.emoji}
                </span>
                <span
                  className={`text-sm font-black px-2.5 py-1 rounded-full border ${
                    isSurvival
                      ? "border-orange-400/40 bg-orange-500/15 text-orange-200"
                      : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                  }`}
                >
                  {mode.badge}
                </span>
              </div>

              <h2 className="text-2xl sm:text-[1.65rem] font-black text-white leading-tight mb-1">
                {mode.name}
              </h2>
              <p
                className={`text-base sm:text-lg font-bold mb-3 ${
                  isSurvival ? "text-orange-200/90" : "text-emerald-200/90"
                }`}
              >
                {mode.tagline}
              </p>
              <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-4">{mode.description}</p>

              <ul className="space-y-1.5 mb-4">
                {mode.bullets.map((b) => (
                  <li key={b} className="text-gray-300 text-base flex items-center gap-2">
                    <span className={isSurvival ? "text-orange-400" : "text-emerald-400"}>•</span>
                    {b}
                  </li>
                ))}
              </ul>

              {isSurvival ? (
                <div
                  className="rounded-2xl border border-orange-500/30 bg-black/30 px-4 py-3 tournament-survival-pulse"
                  aria-hidden
                >
                  <p className="text-xs font-bold text-orange-300/80 uppercase tracking-wide mb-1">예시 · Day 3</p>
                  <p className="text-xl font-black text-white">
                    시작 87명 → <span className="text-orange-300">{survivors}명 생존</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-black/30 px-4 py-3" aria-hidden>
                  <div className="flex items-end justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-emerald-300/80 uppercase tracking-wide">예시 · 시즌 적중률</p>
                    <p className="text-2xl font-black text-emerald-300">72%</p>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 tournament-accuracy-bar" />
                  </div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">5일 중 4일 적중 · 순위 3위</p>
                </div>
              )}

              {active && (
                <p
                  className={`mt-3 text-sm font-black text-center ${
                    isSurvival ? "text-orange-300" : "text-emerald-300"
                  }`}
                >
                  ✓ 선택됨
                </p>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-gray-500 text-base sm:text-lg font-medium px-2">
        로그인 후 <span className="text-white font-bold">생존전</span>과{" "}
        <span className="text-white font-bold">적중대결</span>에 동시 참가 · 제출은 하루 한 번
      </p>
    </div>
  );
}
