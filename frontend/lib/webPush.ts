"use client";

import { getVapidPublicKey, savePushSubscription } from "@/lib/api";

export type WebPushEnvironment = {
  isIOS: boolean;
  isStandalone: boolean;
  /** iOS Safari 탭 등 — 웹 푸시 구독 불가 */
  iosNeedsHomeScreen: boolean;
  /** 이 환경에서 pushManager.subscribe 가능 */
  canSubscribe: boolean;
  supportsNotifications: boolean;
  supportsServiceWorker: boolean;
};

export function getWebPushEnvironment(): WebPushEnvironment {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isStandalone: false,
      iosNeedsHomeScreen: false,
      canSubscribe: false,
      supportsNotifications: false,
      supportsServiceWorker: false,
    };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supportsNotifications = "Notification" in window;
  const supportsServiceWorker = "serviceWorker" in navigator;
  const iosNeedsHomeScreen = isIOS && !isStandalone;
  const canSubscribe = supportsNotifications && supportsServiceWorker && !iosNeedsHomeScreen;
  return {
    isIOS,
    isStandalone,
    iosNeedsHomeScreen,
    canSubscribe,
    supportsNotifications,
    supportsServiceWorker,
  };
}

/** iPhone에서 실제로 푸시를 받을 수 있는 상태인지 (홈 화면 앱 + 서버 구독) */
export function isWebPushDeliveryReady(hasPushOnServer: boolean): boolean {
  const env = getWebPushEnvironment();
  if (!hasPushOnServer) return false;
  if (env.iosNeedsHomeScreen) return false;
  return true;
}

export async function subscribeWebPush(accessToken: string): Promise<void> {
  const env = getWebPushEnvironment();
  if (!env.canSubscribe) {
    if (env.iosNeedsHomeScreen) {
      throw new Error("iPhone은 Safari 탭이 아니라 홈 화면에 추가한 앱에서만 알림을 켤 수 있어요.");
    }
    throw new Error("이 브라우저는 알림을 지원하지 않아요.");
  }
  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 거부됐어요. 기기 설정에서 허용해 주세요.");
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  await reg.update();
  await navigator.serviceWorker.ready;
  const vapidKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || (await getVapidPublicKey());
  if (!vapidKey) {
    throw new Error("서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.");
  }
  const keyBytes = Uint8Array.from(
    atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes,
  });
  await savePushSubscription(accessToken, sub.toJSON());
}
