// Помощник для работы без интернета: сохраняет файлы приложения в память телефона.
const CACHE = 'electro-v9';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'norms.js', 'potee.js', 'extras.js', 'manifest.json', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Сначала пробуем интернет (свежая версия), если его нет — берём из памяти.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

// Нажали на уведомление — открываем нужную заявку
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.hash) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const url = './#' + hash;
    if (list.length) { list[0].navigate(url); return list[0].focus(); }
    return self.clients.openWindow(url);
  }));
});
