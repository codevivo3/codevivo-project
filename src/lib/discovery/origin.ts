export function isAllowedDiscoveryOrigin(
  request: Pick<Request, 'headers'>,
  configuredBaseUrl = process.env.DISCOVERY_BASE_URL,
): boolean {
  if (!configuredBaseUrl) return false;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    if (new URL(origin).origin !== new URL(configuredBaseUrl).origin) {
      return false;
    }
  } catch {
    return false;
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}
