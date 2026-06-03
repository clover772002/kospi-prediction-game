"use client";

import { INSIGHT_CARD_META, type InsightProductSlug } from "@/lib/insight_card_meta";

const PREVIEW_ROWS: {
  slug: InsightProductSlug;
  title: string;
  cardClass: string;
  badgeClass: string;
}[] = [
  {
    slug: "daily_expert_gap",
    title: "우리 적중률 · 비교",
    cardClass: "border-violet-500/30 bg-gradient-to-b from-violet-950/25 to-[#141414]/90",
    badgeClass: "text-violet-300",
  },
  {
    slug: "rolling_crowd_summary",
    title: "우리 적중률 · 7거래일",
    cardClass: "border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-[#141414]/90",
    badgeClass: "text-sky-300",
  },
  {
    slug: "time_slice_accuracy",
    title: "최고 고수 최근 7일 응답 시간",
    cardClass: "border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-[#141414]/90",
    badgeClass: "text-amber-300",
  },
  {
    slug: "expert_vote_time_profile",
    title: "정답자 투표시간대",
    cardClass: "border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 to-[#141414]/90",
    badgeClass: "text-indigo-300",
  },
  {
    slug: "novice_vote_time_profile",
    title: "오답자 투표시간대",
    cardClass: "border-slate-500/30 bg-gradient-to-b from-slate-800/20 to-[#141414]/90",
    badgeClass: "text-slate-300",
  },
  {
    slug: "expert_leader_pick",
    title: "오늘의 고수 픽",
    cardClass: "border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/20 to-[#141414]/90",
    badgeClass: "text-fuchsia-300",
  },
  {
    slug: "novice_leader_pick",
    title: "오늘의 하수 픽",
    cardClass: "border-zinc-500/30 bg-gradient-to-b from-zinc-800/25 to-[#141414]/90",
    badgeClass: "text-zinc-300",
  },
  {
    slug: "crowd_conviction_spread",
    title: "확신도 분포",
    cardClass: "border-rose-500/30 bg-gradient-to-b from-rose-950/25 to-[#141414]/90",
    badgeClass: "text-rose-300",
  },
];

/**
 * 집계 아이템 미리보기: 카탈로그 설명만, 차트 영역은 블러(데이터 미노출).
 * 칩 API를 호출하지 않습니다.
 */
export default function InsightPreviewStack({ surveyDate }: { surveyDate: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-amber-200/80 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 leading-relaxed">
        지금은 참여 규모가 작아 <strong className="text-amber-100">집계 차트·칩 열람은 잠시 닫아 두었어요</strong>. 아래는 각 아이템이 어떤 정보인지
        설명만 확인할 수 있어요. 표본이 쌓이면 공개를 재개할 예정이에요.
      </p>
      {PREVIEW_ROWS.map(({ slug, title, cardClass, badgeClass }) => {
        const meta = INSIGHT_CARD_META[slug];
        return (
          <div
            key={slug}
            className={`rounded-2xl border ${cardClass} px-4 py-3 shadow-[0_0_24px_rgba(0,0,0,.25)]`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-wide ${badgeClass}`}>아이템 · 미리보기</p>
                <p className="text-sm font-black text-white mt-0.5">{title}</p>
                <p className="text-[11px] text-gray-600 mt-0.5 tabular-nums">{surveyDate}</p>
              </div>
              <span className="text-lg shrink-0 opacity-70" aria-hidden>
                🔒
              </span>
            </div>
            <details className="mt-2 border-t border-white/[0.06] pt-2 text-left group">
              <summary className="cursor-pointer list-none text-[10px] font-bold text-gray-500 hover:text-gray-400 [&::-webkit-details-marker]:hidden">
                무엇을 보여 주나요?
                <span className="text-gray-600 ml-1 font-normal opacity-70 group-open:hidden">열기</span>
                <span className="text-gray-600 ml-1 font-normal opacity-70 hidden group-open:inline">접기</span>
              </summary>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{meta.hint}</p>
            </details>
            <div className="mt-3 relative rounded-xl border border-white/10 bg-black/40 overflow-hidden min-h-[4.5rem]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 blur-md select-none pointer-events-none">
                <div className="h-2 w-3/4 max-w-[12rem] rounded bg-gray-600" />
                <div className="h-8 w-full max-w-[14rem] rounded-lg bg-gradient-to-r from-gray-700 to-gray-600" />
                <div className="flex gap-2 w-full max-w-[14rem] justify-center">
                  <span className="h-4 flex-1 rounded bg-green-900/40" />
                  <span className="h-4 flex-1 rounded bg-red-900/40" />
                </div>
              </div>
              <div className="relative z-[1] flex items-center justify-center py-4 text-[10px] font-bold text-gray-500">
                집계·차트는 준비 중
              </div>
            </div>
            {meta.instantExample ? (
              <p className="text-[9px] text-gray-600 mt-2 italic leading-snug">{meta.instantExample}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
