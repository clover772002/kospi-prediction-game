"use client";

import type { ReactNode } from "react";
import type { InsightProductSlug } from "@/lib/insight_card_meta";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";

/**
 * 대시보드 토큰 인사이트 카드: 텍스트·토큰은 좌측(토큰 줄은 제목 아래), 차트 미리보기는 우측 전열.
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
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(132px,44%)] gap-2.5 sm:gap-3 items-stretch min-h-[158px]">
      <div
        className={`min-w-0 flex flex-col gap-2.5 ${tokenRow != null ? "justify-between" : "justify-start"}`}
      >
        <div className="min-w-0">{headline}</div>
        {tokenRow != null ? <div className="flex flex-wrap items-center gap-1.5">{tokenRow}</div> : null}
      </div>
      <div className="rounded-xl overflow-hidden border border-white/[0.1] bg-black/35 flex flex-col min-h-[150px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <InsightAnimatedPreview slug={slug} visual="dashboardHero" />
      </div>
    </div>
  );
}
