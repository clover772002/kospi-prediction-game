"use client";

import type { ReactNode } from "react";
import InsightCardHeroGrid from "@/components/InsightCardHeroGrid";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta, type InsightProductSlug } from "@/lib/insight_card_meta";
import { useInsightDashLayout } from "@/hooks/useInsightDashLayout";

export type InsightUnavailableVariant =
  | "violet"
  | "sky"
  | "emerald"
  | "amber"
  | "indigo"
  | "slate"
  | "rose"
  | "teal"
  | "orange";

type Props = {
  variant: InsightUnavailableVariant;
  slug: InsightProductSlug;
  title: string;
  surveyDate: string;
  surveyDatePrefix?: string;
  badgeExtra?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * 표본 부족·미참여 등으로 본문을 못 줄 때도, 열린 카드와 동일한 테마·차트 미리보기를 보여 줌.
 */
export default function InsightUnavailableCard({
  variant,
  slug,
  title,
  surveyDate,
  surveyDatePrefix = "",
  badgeExtra,
  children,
  footer,
}: Props) {
  const META = insightMeta(slug);
  const { c, cardRound, cardPad, cardGap, badge, titleClass, subDate } = useInsightDashLayout();
  /** 테마 색상은 globals.css의 .iu-card.iu-var-* (프로덕션에서 Tailwind가 동적 클래스를 누락해도 유지) */
  const v = variant;

  return (
    <div
      className={`iu-card iu-var-${v} relative overflow-hidden border ${cardRound} ${cardPad} ${cardGap} fade-up-2 ${
        c ? "pl-3" : "pl-5 pr-4"
      } ${c ? "pr-2" : ""}`}
    >
      <span
        className={`iu-stripe pointer-events-none absolute left-0 rounded-r-full ${
          c ? "top-2 bottom-2 w-[2px]" : "top-4 bottom-4 w-[3px]"
        }`}
        aria-hidden
      />
      <InsightCardHeroGrid
        slug={slug}
        headline={
          <>
            <p className={`iu-badge ${badge} font-black uppercase tracking-wide`}>
              토큰 인사이트{badgeExtra ? ` ${badgeExtra}` : ""}
            </p>
            <p className={`${titleClass} text-white mt-0.5`}>{title}</p>
            <p className={`${subDate} text-gray-600 mt-0.5 tabular-nums`}>
              {surveyDatePrefix}
              {surveyDate}
            </p>
          </>
        }
      />
      <div
        className={`iu-panel rounded-xl border border-solid ${c ? "px-2 py-1.5 space-y-0.5" : "px-3 py-2.5 space-y-1.5"}`}
      >
        {children}
      </div>
      <InsightDetailDisclosure accentSummaryClass="iu-disclosure-trigger">
        <p>{META.hint}</p>
      </InsightDetailDisclosure>
      {footer}
    </div>
  );
}
