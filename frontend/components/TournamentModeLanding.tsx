"use client";

import { TOURNAMENT_RULES } from "@/lib/tournament-copy";

export default function TournamentModeLanding() {
  return (
    <div className="w-full">
      <div className="relative text-left rounded-3xl border-2 border-orange-500/70 bg-gradient-to-b from-[#1a1008]/95 to-[#121212]/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl sm:text-[1.65rem] font-black text-white leading-tight">
            {TOURNAMENT_RULES.title}
          </h2>
          <span className="text-sm font-bold px-2.5 py-1 rounded-full border border-orange-400/40 bg-orange-500/15 text-orange-200">
            {TOURNAMENT_RULES.period}
          </span>
        </div>

        <p className="text-base sm:text-lg font-bold mb-3 text-orange-200/90">{TOURNAMENT_RULES.summary}</p>
        <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-4">{TOURNAMENT_RULES.intro}</p>

        <p className="text-sm font-black text-gray-300 uppercase tracking-wide mb-2">규칙</p>
        <ul className="space-y-1.5 mb-5">
          {TOURNAMENT_RULES.rules.map((rule) => (
            <li key={rule} className="text-gray-300 text-base flex items-start gap-2">
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              {rule}
            </li>
          ))}
        </ul>

        <p className="text-sm font-black text-gray-300 uppercase tracking-wide mb-2">보상</p>
        <ul className="space-y-1.5 mb-4">
          {TOURNAMENT_RULES.rewards.map((reward) => (
            <li key={reward} className="text-gray-300 text-base flex items-start gap-2">
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              {reward}
            </li>
          ))}
        </ul>

        <p className="text-sm text-gray-500 font-medium">{TOURNAMENT_RULES.footnote}</p>
      </div>
    </div>
  );
}
