/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/niccokunzmann/coi-serviceworker */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', (event) => {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
      return;
    }
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
          newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => {
          console.error('COI Service Worker fetch error:', e);
        })
    );
  });
} else {
  (() => {
    const script = document.currentScript;
    if (!script) return;
    
    const reloader = () => {
      navigator.serviceWorker.register(script.src)
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            location.reload();
          });
          if (registration.active && !navigator.serviceWorker.controller) {
            location.reload();
          }
        })
        .catch((err) => {
          console.error('COI Service Worker registration failed:', err);
        });
    };

    if (window.crossOriginIsolated) {
      // Already isolated, do nothing
    } else if (window.isSecureContext) {
      reloader();
    } else {
      console.warn('COI Service Worker requires a secure context (HTTPS/localhost)');
    }
  })();
}
