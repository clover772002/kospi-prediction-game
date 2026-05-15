"use client";

import { useState, type FormEvent } from "react";
import { purchaseConsumable, type ShopConsumableProduct, InsightInsufficientTokensError } from "@/lib/api";

type Props = {
  product: ShopConsumableProduct;
  accessToken: string;
  walletTokens: number | null;
  /** 다른 카드가 구매 처리 중일 때 버튼 비활성 */
  siblingBusy: boolean;
  /** 이 카드가 구매(API) 처리 중인지 — 부모가 slug로 관리 */
  isPurchasing: boolean;
  /** 구매 시작·종료 부모 브리지 */
  onPurchaseStart: () => void;
  onPurchaseEnd: () => void;
  onBalanceRefresh: () => Promise<void>;
  /** 상단 플래시 또는 공용 에러 */
  setFlash: (msg: string | null) => void;
  setErr: (msg: string | null) => void;
};

function needsSurveyDateField(c: ShopConsumableProduct): boolean {
  return Boolean(c.requires_survey_date ?? typeof c.rakeback_pct === "number");
}

export default function ConsumableShopCard({
  product: c,
  accessToken,
  walletTokens,
  siblingBusy,
  isPurchasing,
  onPurchaseStart,
  onPurchaseEnd,
  onBalanceRefresh,
  setFlash,
  setErr,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [surveyDateInput, setSurveyDateInput] = useState("");

  const cost = Number(c.price_tokens) || 0;
  const hasBalanceInfo = walletTokens != null && Number.isFinite(walletTokens);
  const afterPurchase = hasBalanceInfo ? walletTokens - cost : null;
  const sufficient = afterPurchase != null && afterPurchase >= 0;

  const closePanel = () => {
    setPanelOpen(false);
    setSurveyDateInput("");
  };

  const openPurchasePanel = () => {
    setErr(null);
    setSurveyDateInput("");
    setPanelOpen(true);
  };

  const executePurchase = async (e?: FormEvent) => {
    e?.preventDefault();
    setErr(null);
    let survey_date: string | undefined;

    if (needsSurveyDateField(c)) {
      const trimmed = surveyDateInput.trim();
      if (!trimmed || trimmed.length !== 10) {
        setErr("거래일을 YYYY-MM-DD 형식으로 입력해 주세요.");
        return;
      }
      survey_date = trimmed;
    }
    if (c.requires_gauge_payload) {
      setErr("이 상품은 현재 비활성입니다.");
      return;
    }

    onPurchaseStart();
    try {
      const out = await purchaseConsumable(accessToken, {
        consumable_slug: c.slug,
        survey_date: survey_date ?? null,
        gauge_position: null,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `buy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await onBalanceRefresh();
      closePanel();
      const balRaw = out.balance_after ?? out.balance ?? out.spent;
      const balMsg = balRaw != null ? String(balRaw) : "";
      setFlash(balMsg ? `구매가 완료됐습니다. 현재 보유 약 ${balMsg}토큰` : "구매가 완료됐습니다.");
    } catch (err: unknown) {
      if (err instanceof InsightInsufficientTokensError) {
        const req = err.detail.required;
        const hav = err.detail.balance;
        setErr(`토큰이 부족합니다. 필요 ${req ?? "?"} · 보유 ${hav ?? "?"} 토큰`);
        await onBalanceRefresh();
      } else {
        setErr(err instanceof Error ? err.message : "구매하지 못했습니다.");
      }
    } finally {
      onPurchaseEnd();
    }
  };

  const busy = siblingBusy || isPurchasing;

  return (
    <li className="rounded-2xl border border-cyan-500/25 bg-cyan-950/[0.12] px-4 py-3 text-sm space-y-2">
      <p className="font-bold text-white">{c.title}</p>
      {c.description ? <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{c.description}</p> : null}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-amber-300 font-black tabular-nums">{cost} 토큰</p>
        {!panelOpen ? (
          <button
            type="button"
            disabled={busy}
            onClick={openPurchasePanel}
            className="text-[11px] font-black rounded-lg bg-cyan-600/80 hover:bg-cyan-500 px-3 py-1.5 disabled:opacity-45"
          >
            구매
          </button>
        ) : null}
      </div>

      {panelOpen ? (
        <div className="mt-2 rounded-xl border border-white/[0.1] bg-black/35 p-3 space-y-3">
          <p className="text-[12px] font-bold text-white">구매하시겠습니까?</p>
          <ul className="text-[11px] text-gray-300 space-y-1 tabular-nums">
            <li>
              현재 보유:{" "}
              <span className="font-bold text-cyan-200">
                {hasBalanceInfo ? `${walletTokens} 토큰` : "조회 중…"}
              </span>
            </li>
            <li>
              차감: <span className="font-bold text-amber-200">{cost} 토큰</span>
            </li>
            {afterPurchase !== null ? (
              <li>
                예상 보유:{" "}
                <span className={sufficient ? "font-bold text-white" : "font-bold text-red-400"}>
                  {afterPurchase} 토큰
                </span>
              </li>
            ) : null}
          </ul>
          {!sufficient && hasBalanceInfo ? (
            <p className="text-[10px] text-red-400">보유가 부족하면 확인을 눌러도 구매되지 않을 수 있습니다.</p>
          ) : null}

          {needsSurveyDateField(c) ? (
            <form onSubmit={(e) => void executePurchase(e)} className="space-y-2">
              <label className="block text-[10px] text-gray-500">
                거래일 (YYYY-MM-DD)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="예: 2025-06-03"
                  value={surveyDateInput}
                  onChange={(ev) => setSurveyDateInput(ev.target.value)}
                  className="mt-1 block w-full rounded-lg border border-white/15 bg-[#161616] px-2 py-1.5 text-xs text-white placeholder:text-gray-600"
                  maxLength={10}
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    closePanel();
                    setErr(null);
                  }}
                  className="text-[11px] font-bold rounded-lg px-3 py-1.5 border border-white/20 text-gray-300 hover:bg-white/5 disabled:opacity-45"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="text-[11px] font-black rounded-lg bg-cyan-600/90 hover:bg-cyan-500 px-3 py-1.5 disabled:opacity-45"
                >
                  {busy ? "처리 중…" : "확인 후 차감"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  closePanel();
                  setErr(null);
                }}
                className="text-[11px] font-bold rounded-lg px-3 py-1.5 border border-white/20 text-gray-300 hover:bg-white/5 disabled:opacity-45"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executePurchase()}
                className="text-[11px] font-black rounded-lg bg-cyan-600/90 hover:bg-cyan-500 px-3 py-1.5 disabled:opacity-45"
              >
                {busy ? "처리 중…" : "확인 후 차감"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
