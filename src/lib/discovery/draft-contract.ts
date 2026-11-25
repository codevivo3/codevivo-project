import { createHash } from 'node:crypto';
import { parseDiscoveryDateOnly } from './date-only';
import { normalizeDiscoveryPhoneNumber } from './contact-normalization';
import {
  createDiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnaireAnswer,
  type DiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnairePrefill,
} from './questionnaire-core';
import {
  DISCOVERY_QUESTIONNAIRE_VERSION,
  discoveryQuestionnaireFields,
  type DiscoveryQuestionnaireField,
  type DiscoveryQuestionnaireStep,
} from './questionnaire-schema';

export const DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES = 128 * 1024;
export const DISCOVERY_DRAFT_RETENTION_DAYS_DEFAULT = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EDITING_DATE_PATTERN = /^[0-9/]{0,10}$/u;
const PHONE_COUNTRY_PATTERN = /^[A-Z]{2}$/u;
const mutationKeys = new Set([
  'answers',
  'baseRevision',
  'currentStep',
  'editingState',
  'highestStepReached',
  'locale',
  'mutationId',
  'schemaVersion',
]);
const editingStateKeys = new Set([
  'desiredCompletionDate',
  'expectedDate',
  'phoneCountry',
  'phoneInput',
  'preferredStartDate',
]);
const fieldsById = new Map<string, DiscoveryQuestionnaireField>(
  discoveryQuestionnaireFields.map((field) => [field.id, field]),
);

export type DiscoveryDraftEditingState = {
  desiredCompletionDate?: string;
  expectedDate?: string;
  phoneCountry?: string;
  phoneInput?: string;
  preferredStartDate?: string;
};

export type DiscoveryDraftMutation = {
  answers: DiscoveryQuestionnaireAnswers;
  baseRevision: number;
  currentStep: DiscoveryQuestionnaireStep;
  editingState: DiscoveryDraftEditingState;
  highestStepReached: DiscoveryQuestionnaireStep;
  locale: 'en' | 'it';
  mutationHash: string;
  mutationId: string;
  schemaVersion: typeof DISCOVERY_QUESTIONNAIRE_VERSION;
};

export type DiscoveryDraftSnapshot = {
  answers: DiscoveryQuestionnaireAnswers;
  briefId: string;
  currentStep: DiscoveryQuestionnaireStep;
  editingState: DiscoveryDraftEditingState;
  highestStepReached: DiscoveryQuestionnaireStep;
  locale: 'en' | 'it';
  revision: number;
  schemaVersion: string;
  updatedAt: Date;
};

export type DiscoveryDraftOutcome =
  | { outcome: 'available' | 'created' | 'replayed' | 'updated'; draft: DiscoveryDraftSnapshot }
  | { outcome: 'conflict'; draft: DiscoveryDraftSnapshot }
  | { outcome: 'missing' | 'mutation-conflict' | 'submitted' | 'unauthorized' };

export class DiscoveryDraftValidationError extends Error {
  constructor() {
    super('Invalid discovery draft');
    this.name = 'DiscoveryDraftValidationError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stringLimit(field: DiscoveryQuestionnaireField): number {
  if (field.control === 'textarea') return 5_000;
  if (field.control === 'url') return 2_000;
  if (field.control === 'email') return 200;
  if (field.control === 'tel') return 32;
  if (field.control === 'date') return 10;
  return 500;
}

function validateAnswer(
  field: DiscoveryQuestionnaireField,
  value: unknown,
): DiscoveryQuestionnaireAnswer {
  if (field.control === 'workflow-confirmation') {
    if (typeof value !== 'boolean') throw new DiscoveryDraftValidationError();
    return value;
  }

  if (field.control === 'checkbox-group') {
    if (!Array.isArray(value) || value.length > (field.options?.length ?? 0)) {
      throw new DiscoveryDraftValidationError();
    }
    const allowed = new Set<string>(field.options?.map((option) => option.id));
    const values = value.map((entry) => {
      if (typeof entry !== 'string' || !allowed.has(entry)) {
        throw new DiscoveryDraftValidationError();
      }
      return entry;
    });
    if (new Set(values).size !== values.length) {
      throw new DiscoveryDraftValidationError();
    }
    if (
      field.exclusiveOptionId &&
      values.includes(field.exclusiveOptionId) &&
      values.length !== 1
    ) {
      throw new DiscoveryDraftValidationError();
    }
    return values;
  }

  if (typeof value !== 'string' || value.length > stringLimit(field)) {
    throw new DiscoveryDraftValidationError();
  }
  if (field.options && value && !field.options.some((option) => option.id === value)) {
    throw new DiscoveryDraftValidationError();
  }
  if (field.control === 'date' && value && parseDiscoveryDateOnly(value) === null) {
    throw new DiscoveryDraftValidationError();
  }
  if (
    field.control === 'tel' &&
    value &&
    normalizeDiscoveryPhoneNumber(value, 'IT') !== value
  ) {
    throw new DiscoveryDraftValidationError();
  }
  return value;
}

export function validateDiscoveryDraftAnswers(
  value: unknown,
): DiscoveryQuestionnaireAnswers {
  if (!isPlainObject(value)) throw new DiscoveryDraftValidationError();
  const expectedIds = discoveryQuestionnaireFields.map((field) => field.id);
  const suppliedIds = Object.keys(value);
  if (
    suppliedIds.length !== expectedIds.length ||
    suppliedIds.some((fieldId) => !fieldsById.has(fieldId))
  ) {
    throw new DiscoveryDraftValidationError();
  }

  return Object.fromEntries(
    discoveryQuestionnaireFields.map((field) => [
      field.id,
      validateAnswer(field, value[field.id]),
    ]),
  ) as DiscoveryQuestionnaireAnswers;
}

export function validateDiscoveryDraftEditingState(
  value: unknown,
): DiscoveryDraftEditingState {
  if (value === undefined) return {};
  if (!isPlainObject(value)) throw new DiscoveryDraftValidationError();
  if (Object.keys(value).some((key) => !editingStateKeys.has(key))) {
    throw new DiscoveryDraftValidationError();
  }

  const result: DiscoveryDraftEditingState = {};
  for (const key of ['preferredStartDate', 'desiredCompletionDate', 'expectedDate'] as const) {
    const entry = value[key];
    if (entry !== undefined) {
      if (typeof entry !== 'string' || !EDITING_DATE_PATTERN.test(entry)) {
        throw new DiscoveryDraftValidationError();
      }
      result[key] = entry;
    }
  }
  if (value.phoneInput !== undefined) {
    if (typeof value.phoneInput !== 'string' || value.phoneInput.length > 100) {
      throw new DiscoveryDraftValidationError();
    }
    result.phoneInput = value.phoneInput;
  }
  if (value.phoneCountry !== undefined) {
    if (
      typeof value.phoneCountry !== 'string' ||
      !PHONE_COUNTRY_PATTERN.test(value.phoneCountry)
    ) {
      throw new DiscoveryDraftValidationError();
    }
    result.phoneCountry = value.phoneCountry;
  }
  return result;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateDiscoveryDraftMutation(body: unknown): DiscoveryDraftMutation {
  if (!isPlainObject(body)) throw new DiscoveryDraftValidationError();
  if (Object.keys(body).some((key) => !mutationKeys.has(key))) {
    throw new DiscoveryDraftValidationError();
  }
  if (
    body.schemaVersion !== DISCOVERY_QUESTIONNAIRE_VERSION ||
    (body.locale !== 'en' && body.locale !== 'it') ||
    !Number.isSafeInteger(body.baseRevision) ||
    (body.baseRevision as number) < 0 ||
    !Number.isInteger(body.currentStep) ||
    (body.currentStep as number) < 1 ||
    (body.currentStep as number) > 7 ||
    !Number.isInteger(body.highestStepReached) ||
    (body.highestStepReached as number) < (body.currentStep as number) ||
    (body.highestStepReached as number) > 7 ||
    typeof body.mutationId !== 'string' ||
    !UUID_PATTERN.test(body.mutationId)
  ) {
    throw new DiscoveryDraftValidationError();
  }

  const answers = validateDiscoveryDraftAnswers(body.answers);
  const editingState = validateDiscoveryDraftEditingState(body.editingState);
  const canonical = canonicalJson({
    answers,
    baseRevision: body.baseRevision,
    currentStep: body.currentStep,
    editingState,
    highestStepReached: body.highestStepReached,
    locale: body.locale,
    mutationId: body.mutationId.toLowerCase(),
    schemaVersion: body.schemaVersion,
  });

  return {
    answers,
    baseRevision: body.baseRevision as number,
    currentStep: body.currentStep as DiscoveryQuestionnaireStep,
    editingState,
    highestStepReached: body.highestStepReached as DiscoveryQuestionnaireStep,
    locale: body.locale,
    mutationHash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    mutationId: body.mutationId.toLowerCase(),
    schemaVersion: body.schemaVersion,
  };
}

export function validateDiscoveryDraftLocale(value: unknown): 'en' | 'it' {
  if (value !== 'en' && value !== 'it') throw new DiscoveryDraftValidationError();
  return value;
}

export function validateDiscoveryPrefill(value: unknown): DiscoveryQuestionnairePrefill {
  if (!isPlainObject(value)) throw new DiscoveryDraftValidationError();
  const allowed = new Set([
    'companyClient',
    'email',
    'existingWebsite',
    'firstName',
    'industry',
    'lastName',
    'phone',
  ]);
  const result: DiscoveryQuestionnairePrefill = {};
  for (const [key, entry] of Object.entries(value)) {
    const field = fieldsById.get(key);
    if (
      !allowed.has(key) ||
      !field ||
      typeof entry !== 'string' ||
      entry.length > stringLimit(field)
    ) {
      throw new DiscoveryDraftValidationError();
    }
    result[key as keyof DiscoveryQuestionnairePrefill] = entry;
  }
  return result;
}

export function createDiscoveryDraftDefaults(
  prefill: DiscoveryQuestionnairePrefill = {},
): DiscoveryQuestionnaireAnswers {
  return createDiscoveryQuestionnaireAnswers(prefill);
}

export function getDiscoveryDraftRetentionDays(value: string | undefined): number {
  if (value === undefined || value === '') return DISCOVERY_DRAFT_RETENTION_DAYS_DEFAULT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error('DISCOVERY_ABANDONED_RETENTION_DAYS must be an integer from 1 to 365');
  }
  return parsed;
}
