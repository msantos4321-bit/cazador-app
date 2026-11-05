// Permite instalarla como app y recibir avisos (notificaciones). Siempre pide lo más nuevo a internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Cazador de Ofertas", {
    body: d.cuerpo || "",
    icon: d.imagen || "icono-192.png",
    badge: "icono-192.png",
    tag: d.etiqueta || undefined,
    data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const v of ventanas) {
      if (v.url.startsWith(self.registration.scope)) { await v.focus(); return v.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
