"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getExpertChatEligibility, type ExpertChatEligibility } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import ExpertChatTabGate from "@/components/ExpertChatTabGate";

const TABS = [
  { href: "/survey", label: "설문", icon: "📝", activeClass: "app-tab-survey" },
  { href: "/team-chat", label: "단톡", icon: "🗨️", activeClass: "app-tab-team-chat" },
  { href: "/dashboard", label: "대시보드", icon: "📊", activeClass: "app-tab-dashboard" },
  { href: "/expert-chat", label: "고수", icon: "💬", activeClass: "app-tab-expert-chat", expertGate: true },
  { href: "/shop", label: "아이템", icon: "💎", activeClass: "app-tab-shop" },
  { href: "/groups", label: "그룹", icon: "👥", activeClass: "app-tab-groups" },
  { href: "/setup", label: "설정", icon: "⚙️", activeClass: "app-tab-setup" },
] as const;

export default function AppTabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [expertEligibility, setExpertEligibility] = useState<ExpertChatEligibility | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    TABS.forEach((t) => router.prefetch(t.href));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.access_token) {
        setExpertEligibility(null);
        return;
      }
      void getExpertChatEligibility(session.access_token)
        .then((e) => {
          if (!cancelled) setExpertEligibility(e);
        })
        .catch(() => {
          if (!cancelled) setExpertEligibility(null);
        });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.access_token) {
        setExpertEligibility(null);
        return;
      }
      void getExpertChatEligibility(session.access_token)
        .then((e) => setExpertEligibility(e))
        .catch(() => setExpertEligibility(null));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const expertLocked =
    expertEligibility != null && !expertEligibility.can_access_expert_chat;

  return (
    <>
      {gateOpen && expertEligibility && expertLocked ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-24 pt-8"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          role="dialog"
          aria-modal
          aria-labelledby="expert-tab-gate-title"
          onClick={() => setGateOpen(false)}
        >
          <div
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <ExpertChatTabGate
              myBalance={expertEligibility.my_balance}
              minBalance={expertEligibility.min_balance_for_tab}
              tipPerMessage={expertEligibility.tip_tokens_per_message}
              reason={expertEligibility.tab_blocked_reason}
            />
            <button
              type="button"
              onClick={() => setGateOpen(false)}
              className="mt-3 w-full rounded-xl border border-[#333] bg-[#252525] py-2.5 text-sm font-bold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <nav className="app-nav-shell fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] pb-[max(6px,env(safe-area-inset-bottom))]">
        <div className="relative mx-auto flex max-w-md gap-0.5 px-1 pt-1.5">
          <div
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80 app-nav-top-glow"
            aria-hidden
          />
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const isExpert = "expertGate" in tab && tab.expertGate;
            const locked = isExpert && expertLocked;

            const inner = (
              <>
                {active && !locked ? (
                  <span
                    className={`pointer-events-none absolute inset-x-[1px] inset-y-[2px] rounded-[14px] opacity-95 app-tab-active-pulse ${tab.activeClass}`}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`relative z-10 text-xl leading-none transition-transform duration-300 ${
                    active && !locked ? "scale-110 app-nav-icon-float" : "scale-100"
                  } ${locked ? "opacity-50" : ""}`}
                >
                  {locked ? "🔒" : tab.icon}
                </span>
                <span
                  className={`relative z-10 text-[11px] font-bold leading-tight ${
                    active && !locked ? "text-white" : locked ? "text-white/50" : "font-medium text-gray-500"
                  }`}
                >
                  {tab.label}
                </span>
              </>
            );

            if (locked) {
              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => setGateOpen(true)}
                  className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-gray-500 transition-colors active:scale-[0.97]"
                  aria-label="고수 탭 잠금 — 토큰 210개 이상 필요"
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                scroll={false}
                className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-gray-500 transition-colors hover:text-gray-300 active:scale-[0.97]"
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
