"use client";

import { TOURNAMENT_RULES } from "@/lib/tournament-copy";

const sectionTitleClass = "text-2xl sm:text-[1.65rem] font-black text-white leading-tight mb-4";
const listItemClass = "text-gray-300 text-base sm:text-lg leading-relaxed flex items-start gap-2";

export default function TournamentModeLanding() {
  return (
    <div className="w-full">
      <div className="relative text-left rounded-3xl border-2 border-orange-500/70 bg-gradient-to-b from-[#1a1008]/95 to-[#121212]/90 p-5 sm:p-6">
        <h2 className={sectionTitleClass}>{TOURNAMENT_RULES.title}</h2>

        <ul className="space-y-1.5 mb-5">
          {TOURNAMENT_RULES.rules.map((rule) => (
            <li key={rule} className={listItemClass}>
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              {rule}
            </li>
          ))}
        </ul>

        <h3 className={sectionTitleClass}>보상</h3>
        <ul className="space-y-1.5 mb-4">
          {TOURNAMENT_RULES.rewards.map((reward) => (
            <li key={reward} className={listItemClass}>
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              {reward}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
