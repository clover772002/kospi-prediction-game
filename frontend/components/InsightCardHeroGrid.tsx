"use client";

import type { ReactNode } from "react";
import type { InsightProductSlug } from "@/lib/insight_card_meta";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";

/**
 * 대시보드 아이템(집계 열람) 카드: 좌측 제목·토큰은 세로 중앙 묶음, 우측은 낮은 hero 차트(높이 압축). 인라인 블록 min-height는 이전 대비 약 1/3 수준.
 */
export default function InsightCardHeroGrid({
  slug,
  headline,
  tokenRow,
}: {
  slug: InsightProductSlug;
  headline: ReactNode;
  /** 없으면(표본 부족 카드 등) 제목 블록만 좌측에 둠 */
  tokenRow?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(132px,44%)] gap-2 sm:gap-2.5 items-stretch min-h-[72px] sm:min-h-[76px]">
      <div className="min-w-0 flex min-h-0 flex-col justify-center gap-2 py-0.5">
        <div className="min-w-0">{headline}</div>
        {tokenRow != null ? <div className="flex flex-wrap items-center gap-1.5">{tokenRow}</div> : null}
      </div>
      <div className="rounded-xl overflow-hidden border border-white/[0.1] bg-black/35 flex min-h-[64px] h-full min-w-0 flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <InsightAnimatedPreview slug={slug} visual="dashboardHero" />
      </div>
    </div>
  );
}
