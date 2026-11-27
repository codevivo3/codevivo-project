import { createHash } from 'node:crypto';
import {
  isDiscoveryQuestionnaireFieldVisible,
  validateDiscoveryQuestionnaire,
  type DiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnaireErrors,
} from './questionnaire-core';
import {
  DISCOVERY_QUESTIONNAIRE_VERSION,
  discoveryQuestionnaireFields,
  type DiscoveryQuestionnaireField,
  type DiscoveryQuestionnaireFieldId,
} from './questionnaire-schema';
import {
  DiscoveryDraftValidationError,
  isDiscoveryDraftPlainObject,
  validateDiscoveryDraftAnswers,
} from './draft-value-validation';
import {
  normalizeDiscoveryPhoneNumber,
  normalizeDiscoveryWebsiteUrl,
} from './contact-normalization';
import { formatDiscoveryDateOnly, parseDiscoveryDateOnly } from './date-only';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const requestKeys = new Set([
  'answers',
  'expectedRevision',
  'locale',
  'schemaVersion',
  'submissionId',
]);

export type DiscoverySubmissionValidationErrors = DiscoveryQuestionnaireErrors;

export class DiscoverySubmissionValidationError extends Error {
  constructor(readonly errors: DiscoverySubmissionValidationErrors) {
    super('Incomplete discovery submission');
    this.name = 'DiscoverySubmissionValidationError';
  }
}

export type DiscoverySubmission = {
  answers: DiscoveryQuestionnaireAnswers;
  expectedRevision: number;
  locale: 'en' | 'it';
  payloadHash: string;
  schemaVersion: typeof DISCOVERY_QUESTIONNAIRE_VERSION;
  submissionId: string;
};

function emptyAnswer(field: DiscoveryQuestionnaireField): boolean | string | string[] {
  if (field.control === 'checkbox-group') return [];
  if (field.control === 'workflow-confirmation') return false;
  return '';
}

function normalizeAnswer(field: DiscoveryQuestionnaireField, value: boolean | string | string[]) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (field.control === 'email') return trimmed.toLowerCase();
  if (field.control === 'tel') {
    return normalizeDiscoveryPhoneNumber(trimmed, 'IT') ?? trimmed;
  }
  if (field.control === 'url') {
    return normalizeDiscoveryWebsiteUrl(trimmed) ?? trimmed;
  }
  if (field.control === 'date') {
    const parsed = parseDiscoveryDateOnly(trimmed);
    return parsed ? formatDiscoveryDateOnly(parsed) : trimmed;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isDiscoveryDraftPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateDiscoverySubmission(value: unknown): DiscoverySubmission {
  if (!isDiscoveryDraftPlainObject(value)) throw new DiscoveryDraftValidationError();
  if (
    Object.keys(value).length !== requestKeys.size ||
    Object.keys(value).some((key) => !requestKeys.has(key)) ||
    value.schemaVersion !== DISCOVERY_QUESTIONNAIRE_VERSION ||
    (value.locale !== 'en' && value.locale !== 'it') ||
    !Number.isSafeInteger(value.expectedRevision) ||
    (value.expectedRevision as number) < 0 ||
    typeof value.submissionId !== 'string' ||
    !UUID_PATTERN.test(value.submissionId)
  ) {
    throw new DiscoveryDraftValidationError();
  }

  const supplied = validateDiscoveryDraftAnswers(value.answers);
  const answers = { ...supplied };
  for (const field of discoveryQuestionnaireFields) {
    const fieldId = field.id as DiscoveryQuestionnaireFieldId;
    answers[fieldId] = isDiscoveryQuestionnaireFieldVisible(field, supplied)
      ? normalizeAnswer(field, supplied[fieldId])
      : emptyAnswer(field);
  }

  const errors = validateDiscoveryQuestionnaire(answers);
  if (Object.keys(errors).length > 0) {
    throw new DiscoverySubmissionValidationError(errors);
  }

  const submissionId = value.submissionId.toLowerCase();
  const canonical = canonicalJson({
    answers,
    expectedRevision: value.expectedRevision,
    locale: value.locale,
    schemaVersion: value.schemaVersion,
    submissionId,
  });

  return {
    answers,
    expectedRevision: value.expectedRevision as number,
    locale: value.locale,
    payloadHash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    schemaVersion: value.schemaVersion,
    submissionId,
  };
}
