/**
 * Cross-origin isolation service worker.
 *
 * GitHub Pages gives no way to set response headers, but `SharedArrayBuffer` —
 * which the Python call stack visualizer is built on — requires
 * `Cross-Origin-Opener-Policy: same-origin` and
 * `Cross-Origin-Embedder-Policy: require-corp` on the document. A service
 * worker sits between the page and the network, so it can attach headers the
 * origin never sent.
 *
 * This is a trimmed version of the well-known `coi-serviceworker` approach. The
 * usual script also contains a self-registration bootstrap that runs on every
 * page; here registration is driven deliberately from `src/lib/python/coi.ts`
 * so that only Python routes pay the one-time reload, and Karel and the landing
 * page are untouched for visitors who never open the visualizer.
 *
 * Note that once this worker is active it controls the whole site, so every
 * page ends up isolated — which is why the Karel Pyodide loader must request
 * its CDN script in CORS mode.
 */

self.addEventListener('install', () => {
  // Take over without waiting for existing tabs to close; the page that
  // registered us is about to reload through us.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'deregister') {
    self.registration
      .unregister()
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url)));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // A navigation preload or back/forward cache probe; responding to these
  // throws, so let the browser handle them itself.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  event.respondWith(
    fetch(
      // `no-cors` yields an opaque response with no readable headers, which
      // `require-corp` then blocks. Upgrading to a CORS request means a CDN
      // that sends `Access-Control-Allow-Origin` (jsDelivr does) still works.
      request.mode === 'no-cors'
        ? new Request(request, { mode: 'cors', credentials: 'omit' })
        : request
    )
      .then((response) => {
        // Opaque responses have no body or headers to rewrite.
        if (response.status === 0) return response;

        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        // Lets the isolated document embed this resource at all.
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      })
      .catch((error) => {
        console.error('coi-serviceworker:', error);
        return new Response('Network error', { status: 502, statusText: 'Bad Gateway' });
      })
  );
});
