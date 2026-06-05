"use client";

import { SURVIVAL_MODE } from "@/lib/tournament-copy";

export default function TournamentModeLanding() {
  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div
          className="relative text-left rounded-3xl border-2 border-orange-500/70 bg-gradient-to-b from-[#1a1008]/95 to-[#121212]/90 p-5 sm:p-6"
        >
          <div className="flex items-start justify-end gap-2 mb-3">
            <span className="text-sm font-black px-2.5 py-1 rounded-full border border-orange-400/40 bg-orange-500/15 text-orange-200">
              {SURVIVAL_MODE.badge}
            </span>
          </div>

          <h2 className="text-2xl sm:text-[1.65rem] font-black text-white leading-tight mb-1">
            {SURVIVAL_MODE.name}
          </h2>
          <p className="text-base sm:text-lg font-bold mb-3 text-orange-200/90">{SURVIVAL_MODE.tagline}</p>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-4">{SURVIVAL_MODE.description}</p>

          <ul className="space-y-1.5 mb-2">
            {SURVIVAL_MODE.bullets.map((b) => (
              <li key={b} className="text-gray-300 text-base flex items-center gap-2">
                <span className="text-orange-400">•</span>
                {b}
              </li>
            ))}
          </ul>

          <p className="text-sm text-gray-500 mt-3 font-medium">
            제출은 하루 한 번이며, 결과는 생존 인증서와 함께 확인할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
