// Mínimo para que el teléfono la deje instalar como app. Siempre pide lo más nuevo a internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
