// 웹 푸시 Service Worker v4
const SW_VERSION = "4.0";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let title = "코스피 예측";
  let body  = "오늘 장 예측 설문이 열렸어요. 탭해서 참여하세요 👆";
  let url   = "/survey";
  let tag   = "survey";

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.title) title = payload.title;
      if (payload.body)  body  = payload.body;
      if (payload.url)   url   = payload.url;
      if (payload.type)  tag   = payload.type;
    } catch {
      // JSON 파싱 실패 시 텍스트 그대로 본문에 사용
      body = event.data.text() || body;
    }
  }

  // iOS Safari는 requireInteraction, actions 일부 미지원 → 제거
  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag,          // 같은 tag면 덮어써서 중복 방지
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/survey";
  const fullUrl = path.startsWith("http") ? path : self.location.origin + path;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl);
    })
  );
});
