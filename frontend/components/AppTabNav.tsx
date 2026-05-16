"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/survey", label: "설문", icon: "📝", activeClass: "app-tab-survey" },
  { href: "/dashboard", label: "대시보드", icon: "📊", activeClass: "app-tab-dashboard" },
  { href: "/shop", label: "아이템", icon: "💎", activeClass: "app-tab-shop" },
  { href: "/groups", label: "그룹", icon: "👥", activeClass: "app-tab-groups" },
  { href: "/setup", label: "설정", icon: "⚙️", activeClass: "app-tab-setup" },
] as const;

export default function AppTabNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    TABS.forEach((t) => router.prefetch(t.href));
  }, [router]);

  return (
    <nav className="app-nav-shell fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] pb-[max(6px,env(safe-area-inset-bottom))]">
      <div className="relative mx-auto flex max-w-md gap-0.5 px-1 pt-1.5">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80 app-nav-top-glow" aria-hidden />
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              scroll={false}
              className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-gray-500 transition-colors hover:text-gray-300 active:scale-[0.97]"
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <span
                  className={`pointer-events-none absolute inset-x-[1px] inset-y-[2px] rounded-[14px] opacity-95 app-tab-active-pulse ${tab.activeClass}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 text-xl leading-none transition-transform duration-300 ${
                  active ? "scale-110 app-nav-icon-float" : "scale-100"
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`relative z-10 text-[10px] font-bold leading-tight ${
                  active ? "text-white" : "font-medium text-gray-500"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
