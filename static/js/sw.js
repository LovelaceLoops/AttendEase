const CACHE = "attendease-v3";  // bumped — forces all browsers to fetch fresh files
const ASSETS = ["/", "/student", "/professor", "/static/css/theme.css"];

self.addEventListener("install", e => {
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  // Delete ALL old caches so stale HTML/JS is never served
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", e => {
  // Network-first for HTML and JS so updates always reach the browser
  const url = new URL(e.request.url);
  const isHtmlOrJs = url.pathname.endsWith('.html') ||
                     url.pathname.endsWith('.js')   ||
                     url.pathname === '/';

  if (isHtmlOrJs) {
    // Always fetch fresh from network, fall back to cache only if offline
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for CSS, images etc.
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
