"use client";

import { useEffect, useState } from "react";

export type TopExpertNoticeKind = "appointed" | "dethroned" | null;

function storageKey(userId: string): string {
  return `kospi_was_top_expert:${userId}`;
}

/** 설문 제출 직후 등 — 이후 박탈 감지용 */
export function markWasTopExpert(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), "1");
}

/**
 * 이전에 최고 고수였는지와 현재 여부를 비교해 안내 종류를 결정합니다.
 * 박탈은 한 번 감지되면 저장 플래그를 지워 반복 표시를 막습니다.
 */
export function resolveTopExpertNotice(
  userId: string | null | undefined,
  isTopExpertNow: boolean,
): TopExpertNoticeKind {
  if (!userId || typeof window === "undefined") {
    return isTopExpertNow ? "appointed" : null;
  }
  const k = storageKey(userId);
  const was = localStorage.getItem(k) === "1";
  if (isTopExpertNow) {
    localStorage.setItem(k, "1");
    return "appointed";
  }
  if (was) {
    localStorage.removeItem(k);
    return "dethroned";
  }
  return null;
}

export function useTopExpertNotice(
  userId: string | null | undefined,
  isGlobalTopExpert: boolean | undefined,
): TopExpertNoticeKind {
  const [notice, setNotice] = useState<TopExpertNoticeKind>(null);

  useEffect(() => {
    if (isGlobalTopExpert === undefined) return;
    setNotice(resolveTopExpertNotice(userId, isGlobalTopExpert));
  }, [userId, isGlobalTopExpert]);

  return notice;
}
