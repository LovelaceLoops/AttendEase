const CACHE = "attendease-v1";
const ASSETS = ["/", "/student", "/professor",
                "/static/css/theme.css"];
 
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
 
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request)
    .then(cached => cached || fetch(e.request)));
});
