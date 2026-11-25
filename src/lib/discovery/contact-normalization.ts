import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';

export function phoneAnswerFromInput(
  value: string,
  country: CountryCode,
): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (parsed?.isValid()) return parsed.number;

  const digits = trimmed.replace(/\D/gu, '');
  if (!digits) return '';
  return trimmed.startsWith('+')
    ? `+${digits}`
    : `+${getCountryCallingCode(country)}${digits}`;
}

export function normalizeDiscoveryPhoneNumber(
  value: string,
  country: CountryCode,
): string | null {
  if (!value.trim()) return '';
  const answer = phoneAnswerFromInput(value, country);
  if (!answer) return null;
  const parsed = parsePhoneNumberFromString(answer);
  return parsed?.isValid() ? parsed.number : null;
}

export function countryFromInternationalPhoneNumber(
  value: string,
): CountryCode | null {
  if (!value.trim().startsWith('+')) return null;
  return parsePhoneNumberFromString(value)?.country ?? null;
}

export function normalizeDiscoveryWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const protocolMatch = trimmed.match(/^([a-z][a-z\d+.-]*):\/\//iu);
  if (protocolMatch && !/^https?:\/\//iu.test(trimmed)) return null;

  const candidate = protocolMatch ? trimmed : `https://${trimmed}`;
  if (/^https?:\/\/https?:\/\//iu.test(candidate)) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;

    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.protocol}//${url.host}${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
