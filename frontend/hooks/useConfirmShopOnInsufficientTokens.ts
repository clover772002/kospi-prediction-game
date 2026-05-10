"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

type InsightTokenDetail = { required?: number; balance?: number };

/** 토큰 부족 시 확인 후 상점으로 이동. 사용자가 거절하면 false. */
export function useConfirmShopOnInsufficientTokens() {
  const router = useRouter();
  return useCallback(
    (detail: InsightTokenDetail) => {
      const need = detail.required ?? "?";
      const have = detail.balance ?? "?";
      const ok =
        typeof window !== "undefined" &&
        window.confirm(`토큰이 부족합니다.\n필요 ${need}개 · 보유 ${have}개\n\n상점으로 이동하시겠습니까?`);
      if (ok) router.push("/shop");
      return ok;
    },
    [router],
  );
}
