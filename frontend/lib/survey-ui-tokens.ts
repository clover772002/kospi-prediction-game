/** 주간 참여 보상 카드와 설문 탭 공통 UI (폰트·간격·카드) */
export const surveyUi = {
  card: "bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-4 sm:px-5 py-5 space-y-5",
  cardTitle: "text-lg sm:text-xl font-black text-amber-200/95",
  cardMeta: "text-sm sm:text-base text-gray-500",
  label: "text-sm sm:text-base font-bold text-gray-400",
  body: "text-base sm:text-lg font-bold",
  bodyMuted: "text-base sm:text-lg text-gray-400 leading-snug",
  numEmphasis: "text-xl sm:text-2xl font-black tabular-nums",
  highlightBox: "rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-4 sm:py-5",
  hint: "text-sm sm:text-base text-gray-500",
  btnPrimary: "w-full rounded-xl py-4 text-base sm:text-lg font-black transition-all active:scale-[0.98]",
  btnSecondary:
    "w-full rounded-xl border border-[#3d3d3d] bg-[#252525] py-4 text-base sm:text-lg font-bold text-white transition-colors hover:border-emerald-500/45 hover:bg-[#2d2d2d] disabled:opacity-45",
} as const;
