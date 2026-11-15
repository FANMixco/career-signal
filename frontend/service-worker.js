// Offline application shell only. Rules durability belongs to IndexedDB.
const CACHE = "career-signal-4d6db35f4fa93f6a";
const ASSETS = ["./", "./index.html", "./app.min.js", "./rules.min.js", "./styles.min.css", "./site.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("career-signal-") && name !== CACHE).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !ASSETS.some((asset) => new URL(asset, self.registration.scope).href === url.href)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
