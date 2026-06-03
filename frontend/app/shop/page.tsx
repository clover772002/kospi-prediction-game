"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createStripePackCheckout, getDashboard, getShopCatalog, ShopCatalog } from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import PageLoadProgress from "@/components/PageLoadProgress";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";
import { clearAllTabSnapshots, peekShopSnapshot, saveShopSnapshot } from "@/lib/tab-session-cache";
import { ChipAmount } from "@/components/ChipAmount";
import ConsumableShopCard from "@/components/ConsumableShopCard";
import InsightProductUnlockList from "@/components/InsightProductUnlockList";
import InsightCardsStack, { InsightsInView, InsightCardsStackSkeleton } from "@/components/InsightCardsStack";
import { InsightDashboardCompactProvider } from "@/contexts/InsightDashboardCompactContext";
import { useInsightSurveyDatePicker } from "@/hooks/useInsightSurveyDatePicker";
import { INSIGHT_PRODUCTS_PREVIEW_ONLY, SHOP_CONSUMABLES_PREVIEW_ONLY } from "@/lib/insight_items_config";

/** 당분간 원화(Stripe) 칩팩 UI 비표시. 다시 켤 때는 true로 변경하고 아래 token pack 섹션·핸들러 복구 */
const SHOW_STRIPE_TOKEN_PACKS = false;

function ShopInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [walletTokens, setWalletTokens] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);

  useLayoutEffect(() => {
    const s = peekShopSnapshot();
    if (s) {
      setCatalog(s.catalog);
      setWalletTokens(s.walletTokens);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const paid = searchParams.get("paid");
    const cancel = searchParams.get("cancel");
    if (paid === "1") {
      setFlash(
        "결제가 완료됐습니다. 웹훅 처리까지 잠시 걸릴 수 있어요. 대시보드에서 새로고침해 칩을 확인해 주세요.",
      );
    } else if (cancel === "1") {
      setFlash("결제를 취소했거나 창을 닫았어요.");
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const load = async (accessToken: string) => {
      setErr(null);
      setRevalidating(true);
      try {
        const c = await getShopCatalog(accessToken);
        if (!mounted) return;
        setCatalog(c);
        setLoading(false);

        let w: number | null = null;
        try {
          const dash = await getDashboard(accessToken);
          if (!mounted) return;
          w = typeof dash.tokens === "number" ? dash.tokens : null;
          setWalletTokens(w);
        } catch {
          /* 카탈로그는 표시하고 잔액만 나중에 새로고침 가능 */
        }
        saveShopSnapshot({ catalog: c, walletTokens: w });
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      if (event === "INITIAL_SESSION" && !session) {
        router.replace("/");
        setLoading(false);
        return;
      }
      if (
        session &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")
      ) {
        setToken(session.access_token);
        void load(session.access_token);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        router.replace("/");
        setLoading(false);
        return;
      }
      setToken(session.access_token);
      void load(session.access_token).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const [purchaseBusy, setPurchaseBusy] = useState<string | null>(null);
  /** 잠금 해제 후 집계 카드 데이터 리패치(대시보드와 동일 UI) */
  const [insightDeckKey, setInsightDeckKey] = useState(0);

  const { dateOptions, selectedDate, setSelectedDate } = useInsightSurveyDatePicker(token);

  const refreshWalletTokens = async () => {
    if (!token) return;
    try {
      const dash = await getDashboard(token);
      setWalletTokens(typeof dash.tokens === "number" ? dash.tokens : null);
    } catch {
      /* 무시 — 기존 표시값 유지 */
    }
  };

  const handleBuyPack = async (packSlug: string) => {
    if (!token) return;
    setCheckoutSlug(packSlug);
    setErr(null);
    try {
      const { url } = await createStripePackCheckout(token, packSlug);
      window.location.href = url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "결제를 시작하지 못했습니다.");
      setCheckoutSlug(null);
    }
  };

  if (loading && !catalog) {
    return <PageLoadProgress label="상점 불러오는 중…" accent="amber" />;
  }

  return (
    <main className="relative max-w-md mx-auto min-h-screen app-page-tab-pad px-5">
      <StaleRefreshIndicator show={revalidating && !!catalog} tone="amber" />
      <AppAmbientBackground />
      <div className="relative z-10 space-y-6 pt-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <span aria-hidden>🪙</span> 칩 상점
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              게임 내 칩으로 집계 아이템
              {!SHOP_CONSUMABLES_PREVIEW_ONLY ? "·소모품" : ""}을 구매할 수 있어요. 당분간 원화 충전 없이 칩만 사용합니다.
              {SHOP_CONSUMABLES_PREVIEW_ONLY ? " 소모품 구매만 당분간 닫아 두었어요." : ""}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-300 shrink-0 whitespace-nowrap"
          >
            ← 대시보드
          </Link>
        </div>

        {flash ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-100 flex justify-between gap-3 items-start">
            <span>{flash}</span>
            <button type="button" className="text-gray-500 hover:text-white shrink-0" onClick={() => setFlash(null)}>
              닫기
            </button>
          </div>
        ) : null}

        {catalog && !catalog.paywall_enabled ? (
          <p className="text-xs text-gray-500 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
            현재 아이템 잠금(페이월)이 꺼져 있어 집계 카드를 추가 칩 없이 미리 볼 수 있어요. 정책이 켜지면 아래 금액만큼 칩이 필요합니다.
          </p>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-xs text-red-300">
            {err}
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">집계 아이템 (거래일 선택)</h2>
          {INSIGHT_PRODUCTS_PREVIEW_ONLY ? (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              참여 인원이 더 모일 때까지 <strong className="text-gray-300">집계 차트·유료 열람은 잠시 닫혀 있어요</strong>. 각 아이템이 어떤 정보인지{" "}
              <strong className="text-gray-400">설명만</strong> 확인할 수 있고, 숫자·차트는 블러 처리됩니다. 공개를 다시 켜면{" "}
              <Link href="/dashboard" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
                대시보드
              </Link>
              와 동일한 집계를 볼 수 있게 할 예정이에요.
            </p>
          ) : (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              <strong className="text-gray-400">고수보정, 일반통계</strong>는 이름만 두 가지로 보이지만{" "}
              <strong className="text-gray-300">한 장의 카드(고수 가중 vs 다수결)</strong>예요. 잠금이 켜져 있으면 아래 「칩으로 잠금 해제」에서 해제한 뒤 같은 내용이{" "}
              <Link href="/dashboard" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
                대시보드
              </Link>
              에서도 보입니다.
            </p>
          )}
          {dateOptions.length === 0 ? (
            <p className="text-xs text-amber-200/80 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              거래일 목록을 불러오는 중이거나 아직 공개된 설문 이력이 없어요. 잠시 후 다시 열거나 설문에 참여해 보세요.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="insight-survey-date" className="block text-[10px] font-bold text-gray-500">
                집계 기준 거래일
              </label>
              <select
                id="insight-survey-date"
                value={selectedDate ?? ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500/50"
              >
                {dateOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {token && selectedDate ? (
            <div id="shop-insight-deck" className="space-y-2 pt-1">
              <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">이 거래일 집계 열람</h3>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {INSIGHT_PRODUCTS_PREVIEW_ONLY
                  ? "지금은 미리보기 모드예요. 카드 하단 블러 영역에 실제 집계는 표시되지 않아요."
                  : "페이월이 꺼져 있으면 칩 없이 내용이 보일 수 있어요. 잠금이면 카드가 🔐 상태 → 바로 아래에서 칩으로 해제하세요."}
              </p>
              <InsightDashboardCompactProvider>
                <InsightsInView eager fallback={<InsightCardsStackSkeleton />}>
                  <div key={`${selectedDate}-${insightDeckKey}`}>
                    <InsightCardsStack
                      accessToken={token}
                      surveyDate={selectedDate}
                      hideUnlockControl
                      onBalanceUpdated={refreshWalletTokens}
                    />
                  </div>
                </InsightsInView>
              </InsightDashboardCompactProvider>
            </div>
          ) : null}

          {!INSIGHT_PRODUCTS_PREVIEW_ONLY ? (
            <div className="border-t border-white/[0.08] pt-4 space-y-2">
              <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">칩으로 잠금 해제</h3>
              {token && (catalog?.insight_products?.length ?? 0) > 0 ? (
                <InsightProductUnlockList
                  products={catalog!.insight_products}
                  accessToken={token}
                  surveyDate={selectedDate}
                  walletTokens={walletTokens}
                  onBalanceRefresh={refreshWalletTokens}
                  setFlash={setFlash}
                  setErr={setErr}
                  onUnlocked={() => {
                    setInsightDeckKey((k) => k + 1);
                    requestAnimationFrame(() => {
                      document.getElementById("shop-insight-deck")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div className="border-t border-white/[0.08] pt-4">
              <p className="text-[10px] text-gray-500 leading-relaxed rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                칩으로 잠금 해제는 집계 공개가 재개되면 다시 활성화됩니다.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">소모품 (설문·칩 규칙)</h2>
          {SHOP_CONSUMABLES_PREVIEW_ONLY ? (
            <>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                당분간 <strong className="text-gray-300">소모품 구매는 잠시 닫아 두었어요</strong>. 아래는 카탈로그 형태만 블러로 보이며, 버튼·결제 처리는 할 수 없습니다. 다시 열리면 같은 화면에서 구매 가능해질 거예요.
              </p>
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/90 overflow-hidden min-h-[7rem]">
                <div
                  className="pointer-events-none select-none blur-[7px] opacity-[0.45] saturate-75 scale-[0.99]"
                  aria-hidden="true"
                >
                  <ul className="space-y-2 p-1">
                    {(catalog?.consumable_products ?? []).length === 0 ? (
                      <li className="rounded-2xl border border-cyan-500/25 bg-cyan-950/[0.12] px-4 py-8 text-center text-gray-600 text-xs">
                        카탈로그 목록 로딩·빈 목록 표시 예시
                      </li>
                    ) : (
                      (catalog?.consumable_products ?? []).map((c) => (
                        <li
                          key={c.slug}
                          className="rounded-2xl border border-cyan-500/25 bg-cyan-950/[0.12] px-4 py-3 text-sm space-y-2"
                        >
                          <p className="font-bold text-white">{c.title}</p>
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                            {(c.description ?? "").slice(0, 140)}
                            {(c.description?.length ?? 0) > 140 ? "…" : ""}
                          </p>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <ChipAmount amount={Number(c.price_tokens) || 0} className="text-amber-300" />
                            <span className="text-[11px] font-black rounded-lg bg-cyan-600/80 px-3 py-1.5 text-white/70">
                              구매
                            </span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 bg-[#090909]/82 backdrop-blur-[2px] text-center pointer-events-none"
                  role="status"
                  aria-live="polite"
                >
                  <span className="text-3xl grayscale opacity-95" aria-hidden>
                    🔒
                  </span>
                  <p className="text-sm font-black text-gray-100">소모품 구매 준비 중</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed max-w-[260px]">
                    정책·운영 준비가 끝나면 이 패널이 열리고 같은 목록에서 칩으로 구매할 수 있어요.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                거래일 입력이 필요한 소모품만 날짜를 묻습니다. 「재투표」「게이지만 조정」「방향만 반전」은 모두 오늘의 설문(당일 픽) 한정이라 날짜를 받지 않습니다. 레이크백처럼 과거 정산 거래일이 필요한 품목만 YYYY-MM-DD를 입력하세요.
              </p>
              <ul className="space-y-2">
                {(catalog?.consumable_products ?? []).map((c) =>
                  token ? (
                    <ConsumableShopCard
                      key={c.slug}
                      product={c}
                      accessToken={token}
                      walletTokens={walletTokens}
                      siblingBusy={purchaseBusy !== null && purchaseBusy !== c.slug}
                      isPurchasing={purchaseBusy === c.slug}
                      onPurchaseStart={() => setPurchaseBusy(c.slug)}
                      onPurchaseEnd={() => setPurchaseBusy(null)}
                      onBalanceRefresh={refreshWalletTokens}
                      setFlash={setFlash}
                      setErr={setErr}
                    />
                  ) : null,
                )}
              </ul>
            </>
          )}
        </section>

        {SHOW_STRIPE_TOKEN_PACKS ? (
          <section className="space-y-3">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">칩 팩 (Stripe 결제)</h2>
            {!catalog?.stripe_ready ? (
              <p className="text-xs text-gray-500">
                결제(Gateway)가 아직 연결되지 않았습니다. 운영 환경에서 Stripe 키와 Price ID를 설정하면 구매 버튼이 활성화돼요.
              </p>
            ) : null}
            <ul className="space-y-3">
              {(catalog?.token_packs ?? []).map((pack) => {
                const canBuy = Boolean(catalog?.stripe_ready && pack.stripe_price_configured);
                return (
                  <li
                    key={pack.slug}
                    className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-[#141414]/90 px-4 py-4 flex flex-col gap-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <ChipAmount amount={pack.tokens} large className="text-white" />
                      <p className="text-sm text-amber-200 font-bold">{pack.price_label ?? ""}</p>
                    </div>
                    {!pack.stripe_price_configured ? (
                      <p className="text-[10px] text-orange-400/90">서버 환경변수에 이 팩용 Stripe Price ID가 없어요.</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!canBuy || checkoutSlug !== null}
                      onClick={() => void handleBuyPack(pack.slug)}
                      className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 disabled:cursor-not-allowed text-black text-sm font-black transition-all active:scale-[0.98]"
                    >
                      {checkoutSlug === pack.slug ? "이동 중…" : "Stripe로 결제하기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/[0.06] bg-[#111]/80 px-4 py-3 text-[10px] text-gray-500 leading-relaxed space-y-2">
          <p>
            칩은 서비스 내 재화이며 현금으로 환전·환급되지 않습니다. 집계·아이템(열람형 콘텐츠)은 참고용 정보이며 투자·재산 관리 조언이 아닙니다.
          </p>
          <p>
            환불·청약철회 등 유료 이용 관련 세부사항은{" "}
            <Link href="/privacy" className="text-blue-400 hover:underline">
              개인정보처리방침
            </Link>
            과 결제 과정 안내를 참고해 주세요.
          </p>
        </section>
      </div>

      <AppTabNav />
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <main className="relative max-w-md mx-auto min-h-screen flex items-center justify-center">
          <AppAmbientBackground />
          <div className="relative z-10 w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </main>
      }
    >
      <ShopInner />
    </Suspense>
  );
}
