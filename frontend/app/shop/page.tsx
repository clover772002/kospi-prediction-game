"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createStripePackCheckout, getShopCatalog, ShopCatalog } from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";

function ShopInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const paid = searchParams.get("paid");
    const cancel = searchParams.get("cancel");
    if (paid === "1") {
      setFlash(
        "결제가 완료됐습니다. 웹훅 처리까지 잠시 걸릴 수 있어요. 대시보드에서 새로고침해 토큰을 확인해 주세요.",
      );
    } else if (cancel === "1") {
      setFlash("결제를 취소했거나 창을 닫았어요.");
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const load = async (accessToken: string) => {
      setErr(null);
      try {
        const c = await getShopCatalog(accessToken);
        if (mounted) setCatalog(c);
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
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

  if (loading) {
    return (
      <main className="relative max-w-md mx-auto min-h-screen flex items-center justify-center">
        <AppAmbientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-500">상점 불러오는 중…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative max-w-md mx-auto min-h-screen pb-36 px-5">
      <AppAmbientBackground />
      <div className="relative z-10 space-y-6 pt-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              💎 토큰 상점
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              게임 내 토큰으로 집계 인사이트를 열람합니다. 현금 결제로 토큰 팩만 구매할 수 있어요.
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
            현재 인사이트 페이월이 꺼져 있어 대시보드에서 추가 토큰 없이 미리 볼 수 있어요. 정책이 켜지면 아래 요금이 적용됩니다.
          </p>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-xs text-red-300">
            {err}
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">토큰으로 열 수 있는 것</h2>
          <ul className="space-y-2">
            {(catalog?.insight_products ?? []).map((p) => (
              <li
                key={p.slug}
                className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-sm"
              >
                <p className="font-bold text-white">{p.title}</p>
                {p.description ? <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{p.description}</p> : null}
                <p className="text-xs text-amber-300 font-black mt-2 tabular-nums">{p.price_tokens} 토큰</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">토큰 팩 (Stripe 결제)</h2>
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
                    <p className="text-lg font-black text-white tabular-nums">{pack.tokens} 토큰</p>
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

        <section className="rounded-2xl border border-white/[0.06] bg-[#111]/80 px-4 py-3 text-[10px] text-gray-500 leading-relaxed space-y-2">
          <p>
            토큰은 서비스 내 재화이며 현금으로 환전·환급되지 않습니다. 집계·인사이트는 참고용 정보이며 투자·재산 관리 조언이 아닙니다.
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
