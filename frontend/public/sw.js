// 웹 푸시 Service Worker v6
const SW_VERSION = "6.0";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // 버전 확인 요청에 응답
  if (event.data.type === "GET_VERSION") {
    event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
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

  const options = {
    body,
    tag,
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
