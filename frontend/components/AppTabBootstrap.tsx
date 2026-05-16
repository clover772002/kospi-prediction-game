"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { runAppTabPrefetch, APP_TAB_BOOT_MESSAGES } from "@/lib/app-tab-prefetch";
import { isAppTabCacheWarm } from "@/lib/tab-session-cache";

const TAB_PREFIXES = ["/survey", "/dashboard", "/shop", "/groups", "/setup"];

function isAppTabPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AppTabBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTab = isAppTabPath(pathname);
  const [overlay, setOverlay] = useState(false);
  const [label, setLabel] = useState<string>(APP_TAB_BOOT_MESSAGES[0]);

  useLayoutEffect(() => {
    if (!isTab) {
      setOverlay(false);
      return;
    }
    if (isAppTabCacheWarm()) {
      setOverlay(false);
      return;
    }

    let cancelled = false;
    setOverlay(true);
    setLabel(APP_TAB_BOOT_MESSAGES[0]);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        setOverlay(false);
        return;
      }
      void runAppTabPrefetch(session.access_token, (m) => {
        if (!cancelled) setLabel(m);
      })
        .catch((e) => {
          console.error("[AppTabBootstrap] prefetch", e);
        })
        .finally(() => {
          if (!cancelled) setOverlay(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isTab, pathname]);

  return (
    <>
      {children}
      {overlay ? (
        <div
          className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-[#0a0a0a]/95 px-6 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label="데이터 준비 중"
        >
          <div className="mb-6 h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
          <p className="text-center text-base font-black text-white">{label}</p>
          <p className="mt-2 max-w-sm text-center text-xs text-gray-500">
            처음 한 번만 모아서 불러옵니다. 끝나면 탭 이동이 훨씬 빨라져요.
          </p>
        </div>
      ) : null}
    </>
  );
}
