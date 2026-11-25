import {
  discoveryQuestionnaireFields,
  type DiscoveryQuestionnaireField,
  type DiscoveryQuestionnaireFieldId,
  type DiscoveryQuestionnaireStep,
} from './questionnaire-schema';
import {
  normalizeDiscoveryPhoneNumber,
  normalizeDiscoveryWebsiteUrl,
} from './contact-normalization';

export type DiscoveryQuestionnaireAnswer = boolean | string | string[];
export type DiscoveryQuestionnaireAnswers = Record<
  DiscoveryQuestionnaireFieldId,
  DiscoveryQuestionnaireAnswer
>;

export type DiscoveryQuestionnaireError =
  | 'email'
  | 'minLength'
  | 'phone'
  | 'required'
  | 'url';

export type DiscoveryQuestionnaireErrors = Partial<
  Record<DiscoveryQuestionnaireFieldId, DiscoveryQuestionnaireError>
>;

export type DiscoveryQuestionnairePrefill = Partial<
  Record<
    | 'companyClient'
    | 'email'
    | 'existingWebsite'
    | 'firstName'
    | 'industry'
    | 'lastName'
    | 'phone',
    string
  >
>;

export function createDiscoveryQuestionnaireAnswers(
  prefill: DiscoveryQuestionnairePrefill = {},
): DiscoveryQuestionnaireAnswers {
  const answers = Object.fromEntries(
    discoveryQuestionnaireFields.map((field) => [
      field.id,
      field.control === 'checkbox-group'
        ? []
        : field.control === 'workflow-confirmation'
          ? false
          : '',
    ]),
  ) as DiscoveryQuestionnaireAnswers;

  for (const [fieldId, value] of Object.entries(prefill)) {
    if (typeof value === 'string' && fieldId in answers) {
      answers[fieldId as DiscoveryQuestionnaireFieldId] = value;
    }
  }

  return answers;
}

export function updateDiscoveryQuestionnaireAnswer(
  answers: DiscoveryQuestionnaireAnswers,
  fieldId: DiscoveryQuestionnaireFieldId,
  value: DiscoveryQuestionnaireAnswer,
): DiscoveryQuestionnaireAnswers {
  return { ...answers, [fieldId]: value };
}

export function isDiscoveryQuestionnaireFieldVisible(
  field: DiscoveryQuestionnaireField,
  answers: DiscoveryQuestionnaireAnswers,
): boolean {
  if (!field.conditional) return true;

  const dependency = answers[
    field.conditional.fieldId as DiscoveryQuestionnaireFieldId
  ];
  if (field.conditional.value) return dependency === field.conditional.value;
  if (field.conditional.includes) {
    return Array.isArray(dependency) && dependency.includes(field.conditional.includes);
  }
  return false;
}

export function toggleDiscoveryQuestionnaireOption(
  answers: DiscoveryQuestionnaireAnswers,
  field: DiscoveryQuestionnaireField,
  optionId: string,
  checked: boolean,
): DiscoveryQuestionnaireAnswers {
  const current = answers[field.id as DiscoveryQuestionnaireFieldId];
  const selected = Array.isArray(current) ? current : [];
  let next = checked
    ? Array.from(new Set([...selected, optionId]))
    : selected.filter((value) => value !== optionId);

  if (checked && field.exclusiveOptionId) {
    next = optionId === field.exclusiveOptionId
      ? [field.exclusiveOptionId]
      : next.filter((value) => value !== field.exclusiveOptionId);
  }

  return updateDiscoveryQuestionnaireAnswer(
    answers,
    field.id as DiscoveryQuestionnaireFieldId,
    next,
  );
}

function isEmptyAnswer(answer: DiscoveryQuestionnaireAnswer): boolean {
  if (typeof answer === 'boolean') return !answer;
  if (Array.isArray(answer)) return answer.length === 0;
  return answer.trim().length === 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export function validateDiscoveryQuestionnaireStep(
  step: DiscoveryQuestionnaireStep,
  answers: DiscoveryQuestionnaireAnswers,
): DiscoveryQuestionnaireErrors {
  const errors: DiscoveryQuestionnaireErrors = {};

  for (const field of discoveryQuestionnaireFields as readonly DiscoveryQuestionnaireField[]) {
    if (field.step !== step || !isDiscoveryQuestionnaireFieldVisible(field, answers)) {
      continue;
    }

    const fieldId = field.id as DiscoveryQuestionnaireFieldId;
    const answer = answers[fieldId];
    if (field.required && isEmptyAnswer(answer)) {
      errors[fieldId] = 'required';
      continue;
    }
    if (isEmptyAnswer(answer) || typeof answer !== 'string') continue;
    if (field.control === 'email' && !isValidEmail(answer.trim())) {
      errors[fieldId] = 'email';
    } else if (
      field.control === 'tel' &&
      normalizeDiscoveryPhoneNumber(answer, 'IT') === null
    ) {
      errors[fieldId] = 'phone';
    } else if (
      field.control === 'url' &&
      normalizeDiscoveryWebsiteUrl(answer) === null
    ) {
      errors[fieldId] = 'url';
    } else if (field.minLength && answer.trim().length < field.minLength) {
      errors[fieldId] = 'minLength';
    }
  }

  return errors;
}

export function getDiscoveryQuestionnaireStepFields(
  step: DiscoveryQuestionnaireStep,
  answers: DiscoveryQuestionnaireAnswers,
) {
  return discoveryQuestionnaireFields.filter(
    (field) => field.step === step && isDiscoveryQuestionnaireFieldVisible(field, answers),
  );
}
