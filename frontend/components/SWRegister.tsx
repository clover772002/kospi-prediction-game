"use client";

import { useEffect } from "react";

const EXPECTED_SW_VERSION = "5.0";

export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function initSW() {
      // 현재 활성화된 SW 버전 확인
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const version = await askSWVersion(controller);
        if (version && version !== EXPECTED_SW_VERSION) {
          // 구버전 SW 감지 → 전부 언등록 후 새로 등록
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
          window.location.reload();
          return;
        }
      }

      // SW 등록 / 업데이트
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });

      const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      await reg.update();

      const activate = (w: ServiceWorker) => w.postMessage({ type: "SKIP_WAITING" });
      if (reg.waiting) activate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed") activate(nw);
        });
      });
    }

    initSW().catch(() => {});
  }, []);

  return null;
}

function askSWVersion(controller: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1000); // 1초 응답 없으면 null
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data?.version ?? null);
    };
    controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
}
