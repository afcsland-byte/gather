/* Gather service worker — Version 27
   Network-first for the app document so a new deploy is seen on the next load.
   App-shell + images are cached for instant reload paint.
   Media Range requests are left to the network (caching ranged MP4 is risky). */
const CACHE = "gather-v27";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(["./", "./index.html"]).catch(function () {});
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  let dest = "";
  try { dest = req.destination || ""; } catch (e) {}
  try {
    if (dest === "video" || dest === "audio" || (req.headers && req.headers.get("Range"))) return;
  } catch (e) {}

  let nav = false;
  try {
    const url = new URL(req.url);
    nav = req.mode === "navigate" || dest === "document" ||
      /(?:^|\/)(index\.html)?$/.test(url.pathname) || /Gather-v\d+\.html$/.test(url.pathname);
  } catch (e) {}

  if (nav) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
      })
    );
    return;
  }

  if (dest === "image" || dest === "style" || dest === "script" || dest === "font") {
    event.respondWith(
      caches.match(req).then(function (hit) {
        const fetched = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
          }
          return res;
        }).catch(function () { return hit; });
        return hit || fetched;
      })
    );
  }
});
