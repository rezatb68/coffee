const CACHE = 'cm-v1';
const OFFLINE_URLS = ['/', '/t/3', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== location.origin) return;
	// never cache APIs or live streams
	if (url.pathname.startsWith('/api/') || url.pathname.includes('/stream')) return;

	if (url.pathname.startsWith('/t/') || url.pathname === '/' || url.pathname.startsWith('/icons/') || /\.(woff2?|css|js|png|svg|jpg|webp|avif)$/.test(url.pathname)) {
		// network-first with cache fallback for pages; cache-first for assets
		const isPage = url.pathname === '/' || url.pathname.startsWith('/t/');
		if (isPage) {
			event.respondWith(
				fetch(event.request)
					.then((res) => {
						const copy = res.clone();
						caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
						return res;
					})
					.catch(() => caches.match(event.request).then((c) => c ?? caches.match('/t/')))
			);
		} else {
			event.respondWith(
				caches.match(event.request).then(
					(cached) =>
						cached ??
						fetch(event.request).then((res) => {
							const copy = res.clone();
							caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
							return res;
						})
				)
			);
		}
	}
});
