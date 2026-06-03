"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ExpertChatEligibility } from "@/lib/api";
import { getExpertChatEligibilityCached } from "@/lib/session-api-cache";
import { supabase } from "@/lib/supabase";
import ExpertChatTabGate from "@/components/ExpertChatTabGate";

type TabDef = {
  href: string;
  label: string;
  icon: string;
  activeClass: string;
  expertGate?: boolean;
};

/** 메인: 오늘 할 일 */
const PRIMARY_TABS: TabDef[] = [
  { href: "/survey", label: "설문", icon: "📝", activeClass: "app-tab-survey" },
  { href: "/team-chat", label: "소통방", icon: "🗨️", activeClass: "app-tab-team-chat" },
];

/** 보조: 기록·도구·설정 */
const SECONDARY_TABS: TabDef[] = [
  { href: "/dashboard", label: "대시", icon: "📊", activeClass: "app-tab-dashboard" },
  { href: "/expert-chat", label: "명예의 전당", icon: "🏆", activeClass: "app-tab-expert-chat", expertGate: true },
  { href: "/shop", label: "아이템", icon: "💎", activeClass: "app-tab-shop" },
  { href: "/groups", label: "그룹", icon: "👥", activeClass: "app-tab-groups" },
  { href: "/setup", label: "설정", icon: "⚙️", activeClass: "app-tab-setup" },
];

const ALL_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

type TabButtonProps = {
  tab: TabDef;
  active: boolean;
  locked: boolean;
  variant: "primary" | "secondary";
  onLockedClick?: () => void;
};

function TabButton({ tab, active, locked, variant, onLockedClick }: TabButtonProps) {
  const isPrimary = variant === "primary";

  const inner = (
    <>
      {active && !locked ? (
        <span
          className={`pointer-events-none absolute inset-x-[2px] inset-y-[2px] rounded-[14px] opacity-95 app-tab-active-pulse ${tab.activeClass}`}
          aria-hidden
        />
      ) : null}
      <span
        className={`relative z-10 leading-none transition-transform duration-300 ${
          isPrimary ? "text-2xl" : "text-base"
        } ${active && !locked ? "scale-110 app-nav-icon-float" : "scale-100"} ${locked ? "opacity-50" : ""}`}
      >
        {locked ? "🔒" : tab.icon}
      </span>
      <span
        className={`relative z-10 font-bold leading-tight ${
          isPrimary
            ? `text-xs ${active && !locked ? "text-white" : "text-gray-400"}`
            : `text-[9px] ${active && !locked ? "text-white" : locked ? "text-white/45" : "text-gray-600"}`
        }`}
      >
        {tab.label}
      </span>
    </>
  );

  const className = isPrimary
    ? "relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors active:scale-[0.98]"
    : "relative flex min-h-[36px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors active:scale-[0.97]";

  if (locked && onLockedClick) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        className={`${className} text-gray-600`}
        aria-label="명예의 전당 잠금 — 토큰 210개 이상 필요"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={tab.href}
      prefetch
      scroll={false}
      className={`${className} ${active && !locked ? "text-white" : "text-gray-500 hover:text-gray-400"}`}
      aria-current={active ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}

export default function AppTabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [expertEligibility, setExpertEligibility] = useState<ExpertChatEligibility | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    ALL_TABS.forEach((t) => router.prefetch(t.href));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadEligibility = (accessToken: string) => {
      void getExpertChatEligibilityCached(accessToken)
        .then((e) => {
          if (!cancelled) setExpertEligibility(e);
        })
        .catch(() => {
          if (!cancelled) setExpertEligibility(null);
        });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.access_token) {
        setExpertEligibility(null);
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        loadEligibility(session.access_token);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const expertLocked =
    expertEligibility != null && !expertEligibility.can_access_expert_chat;

  const secondaryActive = SECONDARY_TABS.some((t) => pathname === t.href);

  return (
    <>
      {gateOpen && expertEligibility && expertLocked ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          role="dialog"
          aria-modal
          aria-labelledby="expert-tab-gate-title"
          onClick={() => setGateOpen(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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

      <nav
        className="app-nav-shell fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] pb-[max(4px,env(safe-area-inset-bottom))]"
        aria-label="앱 하단 메뉴"
      >
        <div className="relative mx-auto max-w-md">
          <div
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80 app-nav-top-glow"
            aria-hidden
          />

          {/* 메인: 설문 · 소통방 */}
          <div className="flex gap-1.5 px-2 pt-2 pb-1">
            {PRIMARY_TABS.map((tab) => (
              <TabButton
                key={tab.href}
                tab={tab}
                active={pathname === tab.href}
                locked={false}
                variant="primary"
              />
            ))}
          </div>

          {/* 보조: 대시보드 · 고수 · … */}
          <div
            className={`flex items-stretch gap-0.5 border-t px-1.5 py-1 ${
              secondaryActive ? "border-white/10 bg-white/[0.03]" : "border-white/[0.05] bg-black/20"
            }`}
          >
            <span className="sr-only">기록·도구·설정</span>
            {SECONDARY_TABS.map((tab) => {
              const locked = Boolean(tab.expertGate && expertLocked);
              return (
                <TabButton
                  key={tab.href}
                  tab={tab}
                  active={pathname === tab.href}
                  locked={locked}
                  variant="secondary"
                  onLockedClick={locked ? () => setGateOpen(true) : undefined}
                />
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
