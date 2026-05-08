"use client";

import { useEffect } from "react";

/**
 * 모든 페이지에서 Service Worker를 등록하고,
 * 매 방문마다 강제로 업데이트를 체크합니다.
 * Safari iOS는 updateViaCache: 'none' 없이 캐시된 구버전을 계속 사용합니다.
 */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", {
        updateViaCache: "none", // 브라우저 HTTP 캐시 무시 — 항상 서버에서 새 sw.js 확인
      })
      .then((reg) => {
        // 이미 등록돼 있어도 매번 업데이트 체크
        reg.update();

        // 새 SW가 대기 중이면 즉시 활성화 요청
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // 등록 실패는 조용히 무시 (알림 기능에만 영향)
      });
  }, []);

  return null;
}
