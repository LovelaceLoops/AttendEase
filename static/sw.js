const CACHE = "attendease-v3";
const ASSETS = ["/", "/student", "/professor", "/static/css/theme.css"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isHtmlOrJs = url.pathname.endsWith('.html') ||
                     url.pathname.endsWith('.js')   ||
                     url.pathname === '/';
  if (isHtmlOrJs) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});