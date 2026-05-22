"use client";

import LoadingPurposeSplash from "@/components/LoadingPurposeSplash";

type Accent = "blue" | "green" | "amber" | "violet";

interface PageLoadProgressProps {
  label?: string;
  accent?: Accent;
}

/** 탭 전환 로딩: 게이지 + 화면 주변 무작위 목적 안내 */
export default function PageLoadProgress({
  label = "불러오는 중…",
  accent = "blue",
}: PageLoadProgressProps) {
  return (
    <LoadingPurposeSplash
      label={label}
      accent={accent}
      mode="progress"
    />
  );
}
