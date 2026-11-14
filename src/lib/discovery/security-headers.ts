export const DISCOVERY_SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
} as const;

export function applyDiscoverySecurityHeaders(headers: Headers): Headers {
  for (const [name, value] of Object.entries(DISCOVERY_SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return headers;
}
