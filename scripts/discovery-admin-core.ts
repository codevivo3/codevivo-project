import { validateDiscoveryPrefill } from '../src/lib/discovery/draft-contract';
import type { DiscoveryQuestionnairePrefill } from '../src/lib/discovery/questionnaire-core';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type OptionalAdminValue = { provided: boolean; value: string };

export function parseOptionalAdminValue(input: string): OptionalAdminValue {
  const value = input.trim();
  if (!value) return { provided: false, value: '' };
  if (value === '-') return { provided: true, value: '' };
  return { provided: true, value };
}

export function validateAdminEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 200 || !EMAIL_PATTERN.test(email)) {
    throw new Error('A valid authorized email is required');
  }
  return email;
}

export function validateOptionalInquiryId(value: string): string | null {
  const candidate = value.trim().toLowerCase();
  if (!candidate) return null;
  if (!UUID_PATTERN.test(candidate)) throw new Error('Inquiry ID must be a UUID');
  return candidate;
}

export function buildInvitationPrefill(input: {
  company: OptionalAdminValue;
  email: string;
  firstName: OptionalAdminValue;
  inquiryEmail?: string;
  lastName: OptionalAdminValue;
}): DiscoveryQuestionnairePrefill {
  const prefill: DiscoveryQuestionnairePrefill = {};
  if (input.inquiryEmail) prefill.email = validateAdminEmail(input.inquiryEmail);
  prefill.email = validateAdminEmail(input.email);
  if (input.firstName.provided) prefill.firstName = input.firstName.value;
  if (input.lastName.provided) prefill.lastName = input.lastName.value;
  if (input.company.provided) prefill.companyClient = input.company.value;
  return validateDiscoveryPrefill(prefill);
}

export function invitationDisplayName(input: {
  company: OptionalAdminValue;
  firstName: OptionalAdminValue;
  inquiryDisplayName?: string;
  lastName: OptionalAdminValue;
}): string {
  const person = [input.firstName.value, input.lastName.value].filter(Boolean).join(' ');
  const displayName = input.company.value || person || input.inquiryDisplayName?.trim();
  if (!displayName || displayName.length > 200) {
    throw new Error('A client name, company, or associated inquiry is required');
  }
  return displayName;
}

export function validateInvitationExtensionDays(value: string): number {
  const days = Number(value.trim());
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('Extension days must be an integer from 1 to 365');
  }
  return days;
}
