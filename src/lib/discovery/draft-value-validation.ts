import { parseDiscoveryDateOnly } from './date-only';
import { normalizeDiscoveryPhoneNumber } from './contact-normalization';
import type {
  DiscoveryQuestionnaireAnswer,
  DiscoveryQuestionnaireAnswers,
} from './questionnaire-core';
import {
  discoveryQuestionnaireFields,
  type DiscoveryQuestionnaireField,
} from './questionnaire-schema';

const EDITING_DATE_PATTERN = /^[0-9/]{0,10}$/u;
const PHONE_COUNTRY_PATTERN = /^[A-Z]{2}$/u;
const editingStateKeys = new Set([
  'desiredCompletionDate',
  'expectedDate',
  'phoneCountry',
  'phoneInput',
  'preferredStartDate',
]);

export const discoveryDraftFieldsById = new Map<string, DiscoveryQuestionnaireField>(
  discoveryQuestionnaireFields.map((field) => [field.id, field]),
);

export type DiscoveryDraftEditingState = {
  desiredCompletionDate?: string;
  expectedDate?: string;
  phoneCountry?: string;
  phoneInput?: string;
  preferredStartDate?: string;
};

export class DiscoveryDraftValidationError extends Error {
  constructor() {
    super('Invalid discovery draft');
    this.name = 'DiscoveryDraftValidationError';
  }
}

export function isDiscoveryDraftPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function getDiscoveryDraftStringLimit(
  field: DiscoveryQuestionnaireField,
): number {
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
  if (typeof value !== 'string' || value.length > getDiscoveryDraftStringLimit(field)) {
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
  if (!isDiscoveryDraftPlainObject(value)) {
    throw new DiscoveryDraftValidationError();
  }
  const expectedIds = discoveryQuestionnaireFields.map((field) => field.id);
  const suppliedIds = Object.keys(value);
  if (
    suppliedIds.length !== expectedIds.length ||
    suppliedIds.some((fieldId) => !discoveryDraftFieldsById.has(fieldId))
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
  if (!isDiscoveryDraftPlainObject(value)) {
        throw new DiscoveryDraftValidationError();
  }
  if (Object.keys(value).some((key) => !editingStateKeys.has(key))) {
        throw new DiscoveryDraftValidationError();
  }
  const result: DiscoveryDraftEditingState = {};
  for (const key of DATE_FIELD_IDS) {
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

const DATE_FIELD_IDS = [
  'preferredStartDate',
  'desiredCompletionDate',
  'expectedDate',
] as const;
