"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { supabase } from "@/lib/supabase";
import { runAppTabPrefetch } from "@/lib/app-tab-prefetch";
import { isAppTabCacheWarm } from "@/lib/tab-session-cache";

const TAB_PREFIXES = ["/survey", "/dashboard", "/expert-chat", "/shop", "/groups", "/setup"];

function isAppTabPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 탭 데이터 프리패치만 수행. 로딩 UI는 각 페이지에서 한 번만 표시(오버레이 중복 방지). */
export default function AppTabBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTab = isAppTabPath(pathname);

  useLayoutEffect(() => {
    if (!isTab || isAppTabCacheWarm()) return;

    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      void runAppTabPrefetch(session.access_token).catch((e) => {
        console.error("[AppTabBootstrap] prefetch", e);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isTab, pathname]);

  return <>{children}</>;
}
