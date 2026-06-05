"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type TabDef = {
  href: string;
  label: string;
  icon: string;
  activeClass: string;
};

const TABS: TabDef[] = [
  { href: "/survey", label: "설문", icon: "📝", activeClass: "app-tab-survey" },
  { href: "/dashboard", label: "대시보드", icon: "📊", activeClass: "app-tab-dashboard" },
  { href: "/expert-chat", label: "명예의 전당", icon: "🏆", activeClass: "app-tab-expert-chat" },
  { href: "/setup", label: "설정", icon: "⚙️", activeClass: "app-tab-setup" },
];

type TabButtonProps = {
  tab: TabDef;
  active: boolean;
};

function TabButton({ tab, active }: TabButtonProps) {
  return (
    <Link
      href={tab.href}
      prefetch
      scroll={false}
      className={`relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors active:scale-[0.98] ${
        active ? "text-white" : "text-gray-500 hover:text-gray-400"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span
          className={`pointer-events-none absolute inset-x-[2px] inset-y-[2px] rounded-[14px] opacity-95 app-tab-active-pulse ${tab.activeClass}`}
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
          active ? "text-white" : "text-gray-400"
        }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export default function AppTabNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    TABS.forEach((t) => router.prefetch(t.href));
  }, [router]);

  return (
    <nav
      className="app-nav-shell fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] pb-[max(4px,env(safe-area-inset-bottom))]"
      aria-label="앱 하단 메뉴"
    >
      <div className="relative mx-auto max-w-md">
        <div
          className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80 app-nav-top-glow"
          aria-hidden
        />
        <div className="flex gap-1 px-2 pt-2 pb-1.5">
          {TABS.map((tab) => (
            <TabButton key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}
        </div>
      </div>
    </nav>
  );
}
