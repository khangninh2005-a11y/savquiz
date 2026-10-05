export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // If request is for backend API or uploaded files, proxy to backend server
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      if (env.BACKEND_URL) {
        const backendOrigin = env.BACKEND_URL.replace(/\/+$/, '');
        const targetUrl = new URL(url.pathname + url.search, backendOrigin);
        
        const headers = new Headers(request.headers);
        headers.set('X-Forwarded-Host', url.host);
        headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

        const proxyRequest = new Request(targetUrl.toString(), {
          method: request.method,
          headers: headers,
          body: request.body,
          redirect: 'follow',
        });

        return fetch(proxyRequest);
      }
    }

    // Otherwise serve static frontend assets (SPA)
    return env.ASSETS.fetch(request);
  }
};
