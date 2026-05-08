// 웹 푸시 Service Worker v3
const SW_VERSION = "3.0";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "코스피 예측 설문", body: event.data.text() };
  }

  const title = payload.title || "코스피 예측 설문";
  const body  = payload.body  || "오늘 장 예측 설문이 열렸어요. 탭해서 참여하세요 👆";
  const url   = payload.url   || "/survey";
  const type  = payload.type  || "";

  // 알림 타입별 액션 버튼 텍스트
  let actionLabel = "📊 지금 예측하기";
  if (type === "group_nudge")    actionLabel = "📝 설문 참여하기";
  else if (type === "challenge") actionLabel = "⚔️ 대결 확인하기";
  else if (type === "result")    actionLabel = "📈 결과 확인하기";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url },
    requireInteraction: true,
    tag: type || "survey",          // 같은 태그면 덮어씌워서 중복 방지
    renotify: true,
    actions: [
      { action: "open", title: actionLabel },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/survey";
  const fullUrl = path.startsWith("http") ? path : self.location.origin + path;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl);
    })
  );
});
