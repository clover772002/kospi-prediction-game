"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { runAppTabPrefetch, APP_TAB_BOOT_MESSAGES } from "@/lib/app-tab-prefetch";
import { isAppTabCacheWarm } from "@/lib/tab-session-cache";
import LoadingPurposeSplash from "@/components/LoadingPurposeSplash";

const TAB_PREFIXES = ["/survey", "/dashboard", "/expert-chat", "/shop", "/groups", "/setup"];

function isAppTabPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AppTabBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTab = isAppTabPath(pathname);
  const [overlay, setOverlay] = useState(false);
  const [bootLabel, setBootLabel] = useState<string>(APP_TAB_BOOT_MESSAGES[0]);

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
    setBootLabel(APP_TAB_BOOT_MESSAGES[0]);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        setOverlay(false);
        return;
      }
      void runAppTabPrefetch(session.access_token, (m) => {
        if (!cancelled) setBootLabel(m);
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
        <LoadingPurposeSplash
          fullscreen
          mode="spinner"
          label={bootLabel}
          sublabel="처음 한 번만 모아서 불러옵니다. 끝나면 탭 이동이 훨씬 빨라져요."
        />
      ) : null}
    </>
  );
}
