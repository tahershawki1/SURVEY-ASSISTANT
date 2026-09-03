/* عامل الخدمة: التطبيق أداة ميدانية تعمل دون اتصال بالكامل.
   استراتيجية: الملفات الأساسية تُخزَّن عند التثبيت وتُقدَّم من الذاكرة أولًا،
   مع تحديثها في الخلفية. طلبات الشبكة الخارجية (ملفات التحديث) لا تُخزَّن أبدًا. */

const CACHE = "masaha-shell-v3";

const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./favicon.ico",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./css/style.css",
  "./js/native-bundle.js", "./js/ui.js", "./js/storage.js",
  "./js/updater.js", "./js/native-updater.js", "./js/app.js",
  "./js/tools/geo.js", "./js/tools/area.js", "./js/tools/leveling.js",
  "./js/tools/traverse.js", "./js/tools/levelcheck.js",
  "./js/pages/home.js", "./js/pages/coords.js", "./js/pages/area.js",
  "./js/pages/leveling.js", "./js/pages/traverse.js", "./js/pages/levelcheck.js",
  "./js/pages/fieldnotes.js", "./js/pages/notifications.js", "./js/pages/settings.js",
  "./pages/coords.html", "./pages/area.html", "./pages/leveling.html",
  "./pages/traverse.html", "./pages/levelcheck.html", "./pages/fieldnotes.html",
  "./pages/notifications.html", "./pages/settings.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // ملفات التحديث تُقرأ من الشبكة دائمًا ولا تُخزَّن
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match("./index.html"));
      return hit || net;
    })
  );
});
