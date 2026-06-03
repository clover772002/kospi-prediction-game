"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import { isInsightProductSlug } from "@/lib/insight_card_meta";
import type { ShopCatalog } from "@/lib/api";
import { getInsightEntitlements, unlockInsightProduct, InsightInsufficientTokensError } from "@/lib/api";

type Product = ShopCatalog["insight_products"][number];

export default function InsightProductUnlockList({
  products,
  accessToken,
  surveyDate,
  walletTokens,
  onBalanceRefresh,
  setFlash,
  setErr,
  onUnlocked,
}: {
  products: Product[];
  accessToken: string;
  surveyDate: string | null;
  walletTokens: number | null;
  onBalanceRefresh: () => void | Promise<void>;
  setFlash: (s: string | null) => void;
  setErr: (s: string | null) => void;
  onUnlocked?: () => void;
}) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [busySlug, setBusySlug] = useState<string | null>(null);
  /** 현재 선택 거래일에 대해 이미 잠금 해제된 상품 slug */
  const [unlockedSlugs, setUnlockedSlugs] = useState<Set<string>>(() => new Set());

  /** 거래일·칩 변경 시: 서버 목록으로만 초기화 (이전 날짜의 로컬 잠금 해제와 섞이지 않음) */
  const loadUnlockedForDate = useCallback(async () => {
    if (!accessToken || !surveyDate) {
      setUnlockedSlugs(new Set());
      return;
    }
    try {
      const d = await getInsightEntitlements(accessToken, surveyDate);
      setUnlockedSlugs(new Set(d.product_slugs ?? []));
    } catch {
      setUnlockedSlugs(new Set());
    }
  }, [accessToken, surveyDate]);

  /**
   * 잠금 해제 직후: 서버 목록과 현재 상태 병합.
   * 페이월 OFF로 entitlement가 없을 때는 방금 해제한 slug만 로컬에 있으므로 덮어쓰면 안 됨.
   */
  const mergeEntitlementsAfterUnlock = useCallback(async () => {
    if (!accessToken || !surveyDate) return;
    try {
      const d = await getInsightEntitlements(accessToken, surveyDate);
      setUnlockedSlugs((prev) => {
        const merged = new Set<string>(d.product_slugs ?? []);
        for (const s of prev) merged.add(s);
        return merged;
      });
    } catch {
      // 서버 실패 시 방금 setUnlockedSlugs로 넣은 낙관적 상태 유지
    }
  }, [accessToken, surveyDate]);

  useEffect(() => {
    void loadUnlockedForDate();
  }, [loadUnlockedForDate]);

  const unlockOne = async (p: Product) => {
    if (!surveyDate) return;
    setErr(null);
    setBusySlug(p.slug);
    try {
      const out = await unlockInsightProduct(accessToken, {
        product_slug: p.slug,
        survey_date: surveyDate,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `shop-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setUnlockedSlugs((prev) => new Set(prev).add(p.slug));

      const bal = typeof out.balance === "number" ? out.balance : null;
      const spent = typeof out.spent === "number" ? out.spent : null;
      if (out.skipped) {
        setFlash(out.message ?? "페이월이 꺼져 있어 별도 칩 차감 없이 열람할 수 있어요.");
      } else if (out.already_unlocked) {
        setFlash("이미 이 거래일에 열람한 기록이 있어요. 대시보드에서 바로 볼 수 있어요.");
      } else if (bal != null && spent != null) {
        setFlash(`잠금 해제했어요. 차감 ${spent.toLocaleString()} 칩 · 잔액 약 ${bal.toLocaleString()} 칩`);
      } else {
        setFlash("잠금 해제가 반영됐어요. 대시보드에서 확인해 보세요.");
      }
      void onBalanceRefresh();
      void mergeEntitlementsAfterUnlock();
      onUnlocked?.();
    } catch (e: unknown) {
      if (e instanceof InsightInsufficientTokensError) {
        void confirmShopOnInsufficientTokens(e.detail);
      } else {
        setErr(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <ul className="space-y-2">
      {products.map((p) => {
        const busy = busySlug === p.slug;
        const done = unlockedSlugs.has(p.slug);
        const disabled = !surveyDate || busy || (busySlug !== null && !busy) || done;
        return (
          <li
            key={p.slug}
            className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="font-bold text-white min-w-0 flex-1">{p.title}</p>
              <p className="text-xs text-amber-300 font-black tabular-nums shrink-0">{p.price_tokens} 칩</p>
            </div>
            {isInsightProductSlug(p.slug) ? <InsightAnimatedPreview slug={p.slug} /> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => void unlockOne(p)}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-[#333] disabled:text-gray-500 text-white text-sm font-black transition-all active:scale-[0.99]"
            >
              {done
                ? "이 거래일 열람 완료"
                : busy
                  ? "처리 중…"
                  : !surveyDate
                    ? "먼저 위에서 거래일을 선택해 주세요"
                    : `${p.price_tokens} 칩으로 잠금 해제`}
            </button>
            {p.description ? (
              <details className="group border-t border-white/[0.06] pt-2 text-left">
                <summary className="cursor-pointer list-none text-[10px] font-bold text-gray-500 hover:text-gray-400 [&::-webkit-details-marker]:hidden">
                  상품 안내
                  <span className="text-gray-600 ml-1 font-normal opacity-70 group-open:hidden">열기</span>
                  <span className="text-gray-600 ml-1 font-normal opacity-70 hidden group-open:inline">접기</span>
                </summary>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{p.description}</p>
              </details>
            ) : null}
            {walletTokens != null ? (
              <p className="text-[10px] text-gray-500 text-center tabular-nums">현재 보유 약 {walletTokens.toLocaleString()} 칩</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
