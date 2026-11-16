// Помощник для работы без интернета: сохраняет файлы приложения в память телефона.
const CACHE = 'psgi-v17';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'norms.js', 'potee.js', 'extras.js', 'kusty.js', 'manifest.json', 'icon.svg', 'improvements.js', 'pdf-export.js', 'ideas.js', 'chat.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js', 'vendor/NotoSans-Regular.ttf', 'manuals/e6-24.pdf', 'manuals/ptf-1.pdf', 'manuals/iks-30a.pdf', 'manuals/kew-6016.pdf', 'manuals/mpi-530.pdf', 'manuals/aid-70c.pdf'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && /^(electro-v|psgi-v)/.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Сначала пробуем интернет (свежая версия), если его нет — берём из памяти.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('Ошибка загрузки');
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
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
