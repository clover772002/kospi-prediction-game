"use client";

import type { ReactNode } from "react";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta, type InsightProductSlug } from "@/lib/insight_card_meta";

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
  /** 테마 색상은 globals.css의 .iu-card.iu-var-* (프로덕션에서 Tailwind가 동적 클래스를 누락해도 유지) */
  const v = variant;

  return (
    <div
      className={`iu-card iu-var-${v} relative overflow-hidden rounded-2xl border pl-5 pr-4 py-4 space-y-3 fade-up-2`}
    >
      <span
        className="iu-stripe pointer-events-none absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="iu-badge text-[10px] font-black uppercase tracking-wide">
          토큰 인사이트{badgeExtra ? ` ${badgeExtra}` : ""}
        </p>
        <p className="text-sm font-black text-white mt-0.5">{title}</p>
        <p className="text-[10px] text-gray-600 mt-0.5 tabular-nums">
          {surveyDatePrefix}
          {surveyDate}
        </p>
      </div>
      <InsightAnimatedPreview slug={slug} />
      <div className="iu-panel rounded-xl border border-solid px-3 py-2.5 space-y-1.5">{children}</div>
      <InsightDetailDisclosure accentSummaryClass="iu-disclosure-trigger">
        <p>{META.hint}</p>
      </InsightDetailDisclosure>
      {footer}
    </div>
  );
}
