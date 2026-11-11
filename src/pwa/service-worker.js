/* YAYDU build __BUILD_VERSION__. Network only: never cache private data or old app shells. */
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting())
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  // API/auth/profile requests and sockets retain their normal browser semantics.
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#103e32"><title>YAYDU — Connection required</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;background:#103e32;color:#f4f0df;font:18px system-ui;text-align:center;padding:24px;box-sizing:border-box}p{max-width:32em;line-height:1.6}a{color:#e9cd91;padding:16px}</style><h1>Connection required</h1><p>Connect to the internet to open YAYDU. Online games and turn timers continue on the server while you are away.</p><a href="/">Try again</a></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )))
})
