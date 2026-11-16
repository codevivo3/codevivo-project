interface ContactOriginInput {
  forwardedHost?: string | null;
  forwardedProtocol?: string | null;
  host?: string | null;
  origin?: string | null;
}

function firstHeaderValue(value: string | null | undefined): string {
  return value?.split(',')[0]?.trim().toLowerCase() ?? '';
}

export function isAllowedContactOrigin(input: ContactOriginInput): boolean {
  const expectedHost = firstHeaderValue(input.forwardedHost || input.host);
  const suppliedProtocol = firstHeaderValue(input.forwardedProtocol);
  if (!expectedHost || !input.origin) return false;

  let origin: URL;
  try {
    origin = new URL(input.origin);
  } catch {
    return false;
  }

  const localDevelopment = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/u.test(
    expectedHost,
  );
  const expectedProtocol = suppliedProtocol
    ? `${suppliedProtocol}:`
    : localDevelopment
      ? 'http:'
      : 'https:';

  return origin.host.toLowerCase() === expectedHost && origin.protocol === expectedProtocol;
}
