"use client";

import { useState } from "react";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import { isInsightProductSlug } from "@/lib/insight_card_meta";
import type { ShopCatalog } from "@/lib/api";
import { unlockInsightProduct, InsightInsufficientTokensError } from "@/lib/api";

type Product = ShopCatalog["insight_products"][number];

export default function InsightProductUnlockList({
  products,
  accessToken,
  surveyDate,
  walletTokens,
  onBalanceRefresh,
  setFlash,
  setErr,
}: {
  products: Product[];
  accessToken: string;
  surveyDate: string | null;
  walletTokens: number | null;
  onBalanceRefresh: () => void | Promise<void>;
  setFlash: (s: string | null) => void;
  setErr: (s: string | null) => void;
}) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [busySlug, setBusySlug] = useState<string | null>(null);

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
      const bal = typeof out.balance === "number" ? out.balance : null;
      const spent = typeof out.spent === "number" ? out.spent : null;
      if (out.already_unlocked) {
        setFlash("이미 이 거래일에 열람한 기록이 있어요. 대시보드에서 바로 볼 수 있어요.");
      } else if (bal != null && spent != null) {
        setFlash(`잠금 해제했어요. 차감 ${spent.toLocaleString()} 토큰 · 잔액 약 ${bal.toLocaleString()} 토큰`);
      } else {
        setFlash("잠금 해제가 반영됐어요. 대시보드에서 확인해 보세요.");
      }
      void onBalanceRefresh();
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
        const disabled = !surveyDate || busy || (busySlug !== null && !busy);
        return (
          <li
            key={p.slug}
            className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="font-bold text-white min-w-0 flex-1">{p.title}</p>
              <p className="text-xs text-amber-300 font-black tabular-nums shrink-0">{p.price_tokens} 토큰</p>
            </div>
            {isInsightProductSlug(p.slug) ? <InsightAnimatedPreview slug={p.slug} /> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => void unlockOne(p)}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-[#333] disabled:text-gray-500 text-white text-sm font-black transition-all active:scale-[0.99]"
            >
              {busy
                ? "처리 중…"
                : !surveyDate
                  ? "먼저 위에서 거래일을 선택해 주세요"
                  : `${p.price_tokens} 토큰으로 잠금 해제`}
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
              <p className="text-[10px] text-gray-500 text-center tabular-nums">현재 보유 약 {walletTokens.toLocaleString()} 토큰</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
