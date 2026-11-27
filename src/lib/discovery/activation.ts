import { applyDiscoverySecurityHeaders } from './security-headers';

export function isDiscoveryEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export function discoveryDisabledResponse(): Response {
  return new Response(JSON.stringify({ status: 'disabled' }), {
    status: 503,
    headers: applyDiscoverySecurityHeaders(
      new Headers({ 'Content-Type': 'application/json' }),
    ),
  });
}

export async function runDiscoveryOperation<T>(
  enabled: string | undefined,
  operation: () => Promise<T>,
): Promise<T | Response> {
  if (!isDiscoveryEnabled(enabled)) return discoveryDisabledResponse();
  return operation();
}
