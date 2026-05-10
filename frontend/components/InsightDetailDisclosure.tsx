"use client";

import { ReactNode } from "react";

type Props = {
  accentSummaryClass?: string;
  children: ReactNode;
};

/** 세부 안내 문구 접기 · 클릭 시 펼침 */
export default function InsightDetailDisclosure({ accentSummaryClass = "text-gray-500 hover:text-gray-300", children }: Props) {
  return (
    <details className="group mt-1">
      <summary
        className={`cursor-pointer text-[10px] font-bold list-none [&::-webkit-details-marker]:hidden ${accentSummaryClass}`}
      >
        <span className="underline underline-offset-2">상세 설명</span>
        <span className="text-gray-600 ml-1 font-normal no-underline opacity-70 group-open:hidden">열기</span>
        <span className="text-gray-600 ml-1 font-normal no-underline opacity-70 hidden group-open:inline">접기</span>
      </summary>
      <div className="mt-2 text-[10px] text-gray-600 leading-relaxed border-t border-white/[0.06] pt-2 space-y-2">{children}</div>
    </details>
  );
}
