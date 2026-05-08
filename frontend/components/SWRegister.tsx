"use client";

import { useEffect } from "react";

/**
 * 모든 페이지에서 Service Worker를 등록하고 매 방문마다 강제 업데이트를 체크합니다.
 * 새 SW가 활성화되면 페이지를 자동 새로고침해 구버전이 알림을 가로채는 것을 방지합니다.
 */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    // 새 SW가 컨트롤을 가져오면 페이지 새로고침 → 구버전 완전 교체
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        reg.update();

        const activateWaiting = (worker: ServiceWorker) => {
          worker.postMessage({ type: "SKIP_WAITING" });
        };

        // 이미 대기 중인 SW가 있으면 즉시 활성화
        if (reg.waiting) {
          activateWaiting(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              activateWaiting(newWorker);
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
