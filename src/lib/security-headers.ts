/**
 * Baseline security headers for every Worker response (HTML, server functions
 * and the Better Auth API). Static assets get the same baseline from public/_headers.
 *
 * The CSP deliberately has no script-src: TanStack Start emits inline hydration
 * scripts, so tightening scripts requires wiring a nonce through Start first.
 */
export const securityHeaders: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";

export function withSecurityHeaders(request: Request, response: Response): Response {
  // Protocol-switching responses cannot be re-wrapped.
  if (response.status === 101) return response;

  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!secured.headers.has(name)) secured.headers.set(name, value);
  }
  if (
    new URL(request.url).protocol === "https:" &&
    !secured.headers.has("Strict-Transport-Security")
  ) {
    secured.headers.set("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY);
  }
  return secured;
}
