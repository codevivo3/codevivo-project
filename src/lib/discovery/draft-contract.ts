import { createHash } from 'node:crypto';
import {
  createDiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnairePrefill,
} from './questionnaire-core';
import {
  DISCOVERY_QUESTIONNAIRE_VERSION,
  type DiscoveryQuestionnaireStep,
} from './questionnaire-schema';
import {
  discoveryDraftFieldsById as fieldsById,
  getDiscoveryDraftStringLimit as stringLimit,
  isDiscoveryDraftPlainObject as isPlainObject,
  DiscoveryDraftValidationError,
  validateDiscoveryDraftAnswers,
  validateDiscoveryDraftEditingState,
  type DiscoveryDraftEditingState,
} from './draft-value-validation';

export {
  DiscoveryDraftValidationError,
  validateDiscoveryDraftAnswers,
  validateDiscoveryDraftEditingState,
  type DiscoveryDraftEditingState,
} from './draft-value-validation';

export const DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES = 128 * 1024;
export const DISCOVERY_DRAFT_RETENTION_DAYS_DEFAULT = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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
