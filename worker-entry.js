const STATIC_SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client https://checkout.razorpay.com/v1/checkout.js https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https://api-academy.deeptrustxai.com wss://api-academy.deeptrustxai.com https://accounts.google.com https://api.razorpay.com https://lumberjack.razorpay.com https://cloudflareinsights.com; frame-src 'self' https://accounts.google.com https://api.razorpay.com; worker-src 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Web-app lab roots need their trailing slash (nginx matches the proxy
    // `location` by the `/compliance-lab/` prefix). Normalise the bare path so
    // an older frontend build that drops the slash still resolves.
    if (url.pathname === '/compliance-lab') {
      return Response.redirect(new URL('/compliance-lab/', url).toString(), 308);
    }

    // Forward /api/, /health, and self-contained web-app labs (each served by
    // its own container behind nginx on the EC2) straight to the backend.
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/health') ||
      url.pathname.startsWith('/compliance-lab/')
    ) {
      const apiOrigin = (env && typeof env.API_ORIGIN === 'string' && env.API_ORIGIN.trim())
        ? env.API_ORIGIN.trim()
        : 'https://api-academy.deeptrustxai.com';
      const targetOrigin = new URL(apiOrigin);
      const backendUrl = new URL(request.url);
      backendUrl.hostname = targetOrigin.hostname;
      backendUrl.protocol = targetOrigin.protocol;
      backendUrl.port = targetOrigin.port;

      const newRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual',
      });

      return fetch(newRequest);
    }

    // Fallback: serve static frontend files with baseline browser security headers
    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
      if (!headers.has(name)) {
        headers.set(name, value);
      }
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
