// Keeps the help pages on the phone once opened, so they open without a connection. Written by _docs/build.py.
const CACHE = 'mh-help-cda6fa806bfd';
const CORE = ["./", "search.html", "docs.css", "docs.js", "search-index.js", "../heart.css", "../theme.css", "../heart.js", "../assets/icon.png", "../assets/favicon.png", "getting-started.html", "roles.html", "today.html", "calendar.html", "timetable.html", "announcements.html", "events.html", "notifications.html", "mentoring.html", "studies.html", "leave.html", "calm.html", "birthdays.html", "department-dashboard.html", "admin.html", "owner.html", "profile.html", "iphone.html", "privacy.html", "faq.html"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mh-help-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// The network first, so pages are never stale online; the saved copy when there's no connection.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!ours) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
