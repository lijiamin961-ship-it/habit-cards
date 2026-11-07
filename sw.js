/* 习惯卡 Service Worker：HTML network-first（更新可达）/ 静态 cache-first / API 永远走网络 */
const VER = "hc-sw-v1";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;                       // 跨域放行
  if (u.pathname.indexOf("/api/") === 0) return;                   // API 永远走网络，不缓存
  if (e.request.mode === "navigate" || (e.request.method === "GET" && (u.pathname === "/" || u.pathname === "/index.html"))) {
    e.respondWith(                                                 // HTML：network-first，断网回缓存
      fetch(e.request).then(function (r) {
        const c = r.clone();
        caches.open(VER).then(function (x) { x.put("/index.html", c); });
        return r;
      }).catch(function () { return caches.match("/index.html"); })
    );
    return;
  }
  if (e.request.method === "GET") {                                // 其余同源 GET：cache-first
    e.respondWith(
      caches.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (r) {
          const c = r.clone();
          caches.open(VER).then(function (x) { x.put(e.request, c); });
          return r;
        });
      })
    );
  }
});
