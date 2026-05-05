// 웹 푸시 Service Worker
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "8:48 알림", body: event.data.text() };
  }

  const title = payload.title || "8:48 — 사고 팔자!";
  const options = {
    body: payload.body || "오늘 장 예측 설문이 열렸어요. 탭해서 참여하세요 👆",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/dashboard" },
    requireInteraction: true,
    actions: [
      { action: "open", title: "📊 지금 예측하기" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
