export const CRM_MANIFEST = {
  id: '/crm',
  name: 'Распечатка PRO — CRM',
  short_name: 'Распечатка',
  lang: 'ru',
  start_url: '/crm/',
  scope: '/crm/',
  display: 'standalone',
  background_color: '#1E1B4B',
  theme_color: '#1E1B4B',
  icons: [
    { src: '/assets/crm-icon-192-v1.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/crm-icon-512-v1.png', sizes: '512x512', type: 'image/png' },
  ],
};

export const SERVICE_WORKER_JS = `// CRM push v2. No page or API caching.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
function crmUrl(value) {
  try {
    var url = new URL(value || '/crm/leads', self.location.origin);
    if (url.origin === self.location.origin && (url.pathname === '/crm' || url.pathname.startsWith('/crm/'))) return url.href;
  } catch (e) {}
  return new URL('/crm/leads', self.location.origin).href;
}
self.addEventListener('push', function (event) {
  var data = {};
  try { data = (event.data ? event.data.json() : {}) || {}; } catch (e) {}
  // Safari requires a visible notification for every push, even with an open app.
  event.waitUntil(self.registration.showNotification(data.title || 'Новая заявка с сайта', {
    body: data.body || 'Откройте раздел «Обращения» в CRM',
    icon: '/assets/crm-icon-192-v1.png',
    tag: data.tag || 'crm-site-lead',
    data: { url: crmUrl(data.url) }
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = crmUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      var c = all[i], current = new URL(c.url);
      if (current.origin !== self.location.origin || !(current.pathname === '/crm' || current.pathname.startsWith('/crm/'))) continue;
      try {
        var target = c.navigate ? await c.navigate(url) : c;
        if (target && target.focus) { await target.focus(); return; }
      } catch (e) {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
`;
