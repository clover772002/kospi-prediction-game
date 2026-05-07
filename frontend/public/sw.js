// 웹 푸시 Service Worker v2
const SW_VERSION = "2.0";

// 새 SW가 설치되면 즉시 활성화 (구 버전 대기 없이)
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
  const options = {
    body: payload.body || "오늘 장 예측 설문이 열렸어요. 탭해서 참여하세요 👆",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/survey" },
    requireInteraction: true,
    actions: [
      { action: "open", title: "📊 지금 예측하기" },
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
