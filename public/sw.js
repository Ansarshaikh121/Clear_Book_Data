/* Clearbook uses the network for all private data. No persistent response cache. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request).catch(() => new Response(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#203541"><title>Clearbook is offline</title><main style="min-height:90vh;display:grid;place-content:center;padding:24px;background:#f6f4ef;color:#203541;font:16px system-ui"><img src="/logo.svg" alt="" width="48" height="48"><h1>You're offline</h1><p>Connect to the internet to access your Clearbook account and transactions.</p><button onclick="location.reload()" style="padding:12px 20px;border:0;border-radius:8px;background:#203541;color:white">Try again</button></main></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    )),
  );
});
