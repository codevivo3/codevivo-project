'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, ExternalLink, Info } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js/max';
import Button from '@/components/ui/Button';
import InternationalPhoneInput from './InternationalPhoneInput';
import DiscoveryDateInput from './DiscoveryDateInput';
import DiscoverySaveStatus from './DiscoverySaveStatus';
import { useDiscoveryDraftPersistence } from './useDiscoveryDraftPersistence';
import { useDiscoverySubmission } from './useDiscoverySubmission';
import { useDiscoveryQuestionnaireStateStore } from './DiscoveryQuestionnaireState';
import {
  createDiscoveryQuestionnaireAnswers,
  getDiscoveryQuestionnaireStepFields,
  isDiscoveryQuestionnaireFieldVisible,
  toggleDiscoveryQuestionnaireOption,
  updateDiscoveryQuestionnaireAnswer,
  validateDiscoveryQuestionnaire,
  validateDiscoveryQuestionnaireStep,
  type DiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnaireErrors,
  type DiscoveryQuestionnairePrefill,
} from '@/lib/discovery/questionnaire-core';
import {
  DISCOVERY_QUESTIONNAIRE_VERSION,
  discoveryQuestionnaireFields,
  discoveryQuestionnaireSections,
  discoveryQuestionnaireSteps,
  type DiscoveryQuestionnaireField,
  type DiscoveryQuestionnaireFieldId,
  type DiscoveryQuestionnaireStep,
} from '@/lib/discovery/questionnaire-schema';
import { normalizeDiscoveryWebsiteUrl } from '@/lib/discovery/contact-normalization';
import { formatDiscoveryDateDisplay, parseDiscoveryDateOnly } from '@/lib/discovery/date-only';
import type { DiscoveryQuestionnaireWorkingSnapshot } from '@/lib/discovery/draft-persistence-core';
import type { DiscoverySubmissionConfirmation } from '@/lib/discovery/draft-contract';

const fieldLabelClassName =
  'font-mono-var text-[11px] font-medium uppercase tracking-[0.18em] text-fg/70';
const inputClassName =
  'brand-border mt-2 w-full rounded-lg border bg-surface/35 px-3 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const inputControlClassName =
  'brand-border w-full rounded-lg border bg-surface/35 px-3 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const choiceClassName =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-surface/25 px-3 py-2.5 text-sm leading-relaxed text-fg transition-colors hover:border-primary/60 focus-within:border-primary';

function ContextualInfo({
  content,
  href,
  label,
  linkLabel,
}: {
  content: string;
  href?: string;
  label: string;
  linkLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const dismissOnPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', dismissOnPointerDown);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className='relative inline-flex align-middle'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type='button'
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(true)}
        className='ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      >
        <Info className='h-4 w-4' aria-hidden='true' />
      </button>
      {open ? (
        <span
          id={popoverId}
          role='dialog'
          aria-label={label}
          className='surface-card fixed inset-x-6 bottom-6 z-30 rounded-lg bg-surface px-3 py-2 font-sans-var text-xs font-normal normal-case leading-relaxed tracking-normal text-fg shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(18rem,calc(100vw-3rem))]'
        >
          <span className='block'>{content}</span>
          {href && linkLabel ? (
            <a
              href={href}
              target='_blank'
              rel='noreferrer noopener'
              referrerPolicy='no-referrer'
              className='mt-2 inline-flex min-h-8 items-center gap-1 font-medium text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            >
              {linkLabel}
              <ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
            </a>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function fieldId(id: string) {
  return `discovery-${id}`;
}

function errorId(id: string) {
  return `${fieldId(id)}-error`;
}

function helpId(id: string) {
  return `${fieldId(id)}-help`;
}

function SubmissionConfirmation({
  confirmation,
  locale,
}: {
  confirmation: DiscoverySubmissionConfirmation;
  locale: 'en' | 'it';
}) {
  const t = useTranslations('discoveryQuestionnaire.submission');
  const submittedAt = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(confirmation.submittedAt);

  return (
    <main className='px-4 pb-16 pt-10 sm:px-6 sm:pt-14'>
      <section
        className='glass-effect surface-card mx-auto max-w-3xl rounded-xl bg-[var(--panel-bg)] p-6 text-center sm:p-10'
        aria-labelledby='discovery-confirmation-title'
      >
        <CheckCircle2 className='mx-auto h-12 w-12 text-primary' aria-hidden='true' />
        <p className='mt-5 font-mono-var text-xs uppercase tracking-[0.2em] text-primary'>
          {t('confirmation.overline')}
        </p>
        <h1 id='discovery-confirmation-title' className='mt-3 text-3xl font-semibold sm:text-4xl'>
          {t('confirmation.title')}
        </h1>
        <p className='mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-fg/70 sm:text-base'>
          {t('confirmation.description')}
        </p>
        <dl className='mx-auto mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-2'>
          <div className='rounded-lg border border-border/70 bg-surface/25 p-4'>
            <dt className={fieldLabelClassName}>{t('confirmation.reference')}</dt>
            <dd className='mt-2 break-words font-mono-var text-sm text-fg'>
              {confirmation.reference}
            </dd>
          </div>
          <div className='rounded-lg border border-border/70 bg-surface/25 p-4'>
            <dt className={fieldLabelClassName}>{t('confirmation.submittedAt')}</dt>
            <dd className='mt-2 text-sm text-fg'>{submittedAt}</dd>
          </div>
        </dl>
        <div className='mx-auto mt-6 max-w-2xl rounded-lg border border-primary/35 bg-primary/10 p-4 text-left'>
          <p className='font-semibold'>{t('confirmation.nextTitle')}</p>
          <p className='mt-1 text-sm leading-relaxed text-fg/70'>
            {t('confirmation.nextDescription')}
          </p>
        </div>
      </section>
    </main>
  );
}

export default function DiscoveryQuestionnaire({
  initialPrefill,
  stateScopeId,
}: {
  initialPrefill?: DiscoveryQuestionnairePrefill;
  stateScopeId: string;
}) {
  const t = useTranslations('discoveryQuestionnaire');
  const activeLocale = useLocale();
  const locale = activeLocale === 'it' ? 'it' : 'en';
  const questionnaireState = useDiscoveryQuestionnaireStateStore();
  const restoredState = useRef(questionnaireState.read(stateScopeId));
  const [answers, setAnswers] = useState<DiscoveryQuestionnaireAnswers>(
    () => restoredState.current?.answers ?? createDiscoveryQuestionnaireAnswers(initialPrefill),
  );
  const [currentStep, setCurrentStep] = useState<DiscoveryQuestionnaireStep>(
    () => restoredState.current?.currentStep ?? 1,
  );
  const [highestStepReached, setHighestStepReached] =
    useState<DiscoveryQuestionnaireStep>(
      () => restoredState.current?.highestStepReached ?? 1,
    );
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    () => restoredState.current?.phoneCountry ?? 'IT',
  );
  const [phoneInput, setPhoneInput] = useState(
    () => restoredState.current?.phoneInput ?? String(answers.phone ?? ''),
  );
  const [errors, setErrors] = useState<DiscoveryQuestionnaireErrors>({});
  const [flushSignal, setFlushSignal] = useState(0);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const currentFields = useMemo(
    () => getDiscoveryQuestionnaireStepFields(currentStep, answers),
    [answers, currentStep],
  );
  const currentSections = discoveryQuestionnaireSections.filter(
    (section) => section.step === currentStep,
  );
  const workingSnapshot = useMemo<DiscoveryQuestionnaireWorkingSnapshot>(() => ({
    answers,
    currentStep,
    highestStepReached,
    locale,
    phoneCountry,
    phoneInput,
  }), [answers, currentStep, highestStepReached, locale, phoneCountry, phoneInput]);
  const hydrateDraft = useCallback((snapshot: DiscoveryQuestionnaireWorkingSnapshot) => {
    setAnswers(snapshot.answers);
    setCurrentStep(snapshot.currentStep);
    setHighestStepReached(snapshot.highestStepReached);
    setPhoneCountry(snapshot.phoneCountry);
    setPhoneInput(snapshot.phoneInput);
    setErrors({});
  }, []);
  const persistence = useDiscoveryDraftPersistence({
    flushSignal,
    onHydrate: hydrateDraft,
    scopeId: stateScopeId,
    snapshot: workingSnapshot,
  });
  const submission = useDiscoverySubmission({
    persistenceController: persistence,
    scopeId: stateScopeId,
  });
  const submissionErrors = useMemo(
    () => validateDiscoveryQuestionnaire(answers),
    [answers],
  );
  const confirmation = submission.state.confirmation ?? persistence.state.submission;
  const editingEnabled =
    persistence.state.ready &&
    persistence.state.status !== 'conflict' &&
    persistence.state.status !== 'unavailable';

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (submission.state.status !== 'validation-error') return;
    setErrors(submission.state.errors);
    const firstError = discoveryQuestionnaireFields.find(
      (field) => submission.state.errors[field.id as DiscoveryQuestionnaireFieldId],
    );
    if (!firstError) return;
    setHighestStepReached((highest) => Math.max(highest, firstError.step) as DiscoveryQuestionnaireStep);
    setCurrentStep(firstError.step);
    requestAnimationFrame(() => document.getElementById(fieldId(firstError.id))?.focus());
  }, [submission.state.errors, submission.state.status]);

  useEffect(() => {
    questionnaireState.save({
      answers,
      currentStep,
      highestStepReached,
      phoneCountry,
      phoneInput,
      scopeId: stateScopeId,
    });
  }, [
    answers,
    currentStep,
    highestStepReached,
    phoneCountry,
    phoneInput,
    questionnaireState,
    stateScopeId,
  ]);

  const navigateToStep = (step: DiscoveryQuestionnaireStep) => {
    if (!editingEnabled || step > highestStepReached) return;
    setErrors({});
    setCurrentStep(step);
    setFlushSignal((value) => value + 1);
  };

  const setAnswer = (
    id: DiscoveryQuestionnaireFieldId,
    value: DiscoveryQuestionnaireAnswers[DiscoveryQuestionnaireFieldId],
  ) => {
    setAnswers((current) => updateDiscoveryQuestionnaireAnswer(current, id, value));
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const goToNextStep = () => {
    const nextErrors = validateDiscoveryQuestionnaireStep(currentStep, answers);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as
      | DiscoveryQuestionnaireFieldId
      | undefined;
    if (firstError) {
      requestAnimationFrame(() => document.getElementById(fieldId(firstError))?.focus());
      return;
    }
    if (currentStep < 7) {
      const nextStep = (currentStep + 1) as DiscoveryQuestionnaireStep;
      setHighestStepReached((highest) => Math.max(highest, nextStep) as DiscoveryQuestionnaireStep);
      setCurrentStep(nextStep);
      setFlushSignal((value) => value + 1);
    }
  };

  const goToPreviousStep = () => {
    setErrors({});
    if (currentStep > 1) {
      navigateToStep((currentStep - 1) as DiscoveryQuestionnaireStep);
    }
  };

  const submitQuestionnaire = () => {
    setErrors(submissionErrors);
    void submission.submit({ clientErrors: submissionErrors, locale });
  };

  const hasFieldHelp = (field: DiscoveryQuestionnaireField) =>
    t.has(`fields.${field.id}.help`);

  const describedBy = (field: DiscoveryQuestionnaireField) => {
    const ids = [hasFieldHelp(field) ? helpId(field.id) : null, errors[field.id as DiscoveryQuestionnaireFieldId]
      ? errorId(field.id)
      : null]
      .filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
  };

  const renderFieldLabel = (field: DiscoveryQuestionnaireField, label: string) => (
    <>
      {label}{' '}
      <span className='normal-case tracking-normal text-fg/45'>
        ({field.required ? t('required') : t('optional')})
      </span>
    </>
  );

  const renderContextualInfo = (field: DiscoveryQuestionnaireField, label: string) =>
    field.contextualHelp ? (
      <ContextualInfo
        label={t('contextualHelp.open', { term: label })}
        content={t(`contextualHelp.${field.contextualHelp}.description`)}
        href={
          t.has(`contextualHelp.${field.contextualHelp}.referenceUrl`)
            ? t(`contextualHelp.${field.contextualHelp}.referenceUrl`)
            : undefined
        }
        linkLabel={t('contextualHelp.learnMore')}
      />
    ) : null;

  const renderError = (field: DiscoveryQuestionnaireField) => {
    const error = errors[field.id as DiscoveryQuestionnaireFieldId];
    if (!error) return null;
    return (
      <p id={errorId(field.id)} className='mt-2 text-sm text-red-400' role='alert'>
        {error === 'minLength'
          ? t('validation.minLength', { count: field.minLength ?? 1 })
          : t(`validation.${error}`)}
      </p>
    );
  };

  const renderField = (field: DiscoveryQuestionnaireField) => {
    const id = field.id as DiscoveryQuestionnaireFieldId;
    const answer = answers[id];
    const label = t(`fields.${field.id}.label`);
    const help = hasFieldHelp(field) ? t(`fields.${field.id}.help`) : null;
    const placeholder = t.has(`fields.${field.id}.placeholder`)
      ? t(`fields.${field.id}.placeholder`)
      : undefined;

    if (field.control === 'workflow-confirmation') {
      return (
        <div key={field.id} className='rounded-lg border border-primary/35 bg-primary/10 p-4'>
          <label className='flex cursor-pointer items-start gap-3 text-sm leading-relaxed'>
            <input
              id={fieldId(field.id)}
              type='checkbox'
              checked={answer === true}
              onChange={(event) => setAnswer(id, event.target.checked)}
              aria-describedby={describedBy(field)}
              aria-invalid={Boolean(errors[id])}
              className='mt-1 h-5 w-5 shrink-0 accent-[var(--brand-blue)]'
            />
            <span>{label}</span>
          </label>
          {help ? (
            <p id={helpId(field.id)} className='mt-2 text-xs leading-relaxed text-fg/60'>
              {help}
            </p>
          ) : null}
          {renderError(field)}
        </div>
      );
    }

    if (field.control === 'radio-group' || field.control === 'checkbox-group') {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <fieldset key={field.id} className='min-w-0'>
          <legend className={fieldLabelClassName}>
            {renderFieldLabel(field, label)}
            {renderContextualInfo(field, label)}
          </legend>
          {help ? (
            <p id={helpId(field.id)} className='mt-1 text-sm leading-relaxed text-fg/60'>
              {help}
            </p>
          ) : null}
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            {(field.options ?? []).map((option) => {
              const checked = field.control === 'radio-group'
                ? answer === option.id
                : selected.includes(option.id);
              return (
                <label key={option.id} className={choiceClassName}>
                  <input
                    id={`${fieldId(field.id)}-${option.id}`}
                    type={field.control === 'radio-group' ? 'radio' : 'checkbox'}
                    name={field.id}
                    value={option.id}
                    checked={checked}
                    onChange={(event) => {
                      if (field.control === 'radio-group') {
                        setAnswer(id, option.id);
                      } else {
                        setAnswers((current) =>
                          toggleDiscoveryQuestionnaireOption(
                            current,
                            field,
                            option.id,
                            event.target.checked,
                          ),
                        );
                        setErrors((current) => {
                          if (!current[id]) return current;
                          const next = { ...current };
                          delete next[id];
                          return next;
                        });
                      }
                    }}
                    aria-describedby={describedBy(field)}
                    aria-invalid={Boolean(errors[id])}
                    className='mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-blue)]'
                  />
                  <span>{t(`options.${field.id}.${option.id}`)}</span>
                </label>
              );
            })}
          </div>
          {renderError(field)}
        </fieldset>
      );
    }

    if (field.control === 'select') {
      return (
        <div key={field.id} className='block min-w-0'>
          <span className='flex items-center'>
            <label htmlFor={fieldId(field.id)} className={fieldLabelClassName}>
              {renderFieldLabel(field, label)}
            </label>
            {renderContextualInfo(field, label)}
          </span>
          {help ? (
            <span id={helpId(field.id)} className='mt-1 block text-sm leading-relaxed text-fg/60'>
              {help}
            </span>
          ) : null}
          <select
            id={fieldId(field.id)}
            value={typeof answer === 'string' ? answer : ''}
            onChange={(event) => setAnswer(id, event.target.value)}
            aria-describedby={describedBy(field)}
            aria-invalid={Boolean(errors[id])}
            className={inputClassName}
          >
            <option value=''>{t('selectPlaceholder')}</option>
            {(field.options ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {t(`options.${field.id}.${option.id}`)}
              </option>
            ))}
          </select>
          {renderError(field)}
        </div>
      );
    }

    const value = typeof answer === 'string' ? answer : '';
    const commonProps = {
      id: fieldId(field.id),
      value,
      required: field.required,
      'aria-describedby': describedBy(field),
      'aria-invalid': Boolean(errors[id]),
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setAnswer(id, event.target.value),
      className: inputClassName,
      placeholder,
    };

    const input = field.control === 'textarea' ? (
      <textarea {...commonProps} rows={4} minLength={field.minLength} />
    ) : field.control === 'tel' ? (
      <InternationalPhoneInput
        country={phoneCountry}
        value={phoneInput}
        describedBy={describedBy(field)}
        invalid={Boolean(errors[id])}
        onChange={(nextInput, nextCountry, answerValue) => {
          setPhoneInput(nextInput);
          setPhoneCountry(nextCountry);
          setAnswer(id, answerValue);
        }}
      />
    ) : field.control === 'url' ? (
      <span className='relative mt-2 block'>
        {!/^https?:\/\//iu.test(value.trim()) ? (
          <span
            aria-hidden='true'
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono-var text-sm text-fg/45'
          >
            https://
          </span>
        ) : null}
        <input
          {...commonProps}
          type='text'
          inputMode='url'
          autoComplete='url'
          className={`${inputControlClassName} ${
            /^https?:\/\//iu.test(value.trim()) ? '' : 'pl-[4.8rem]'
          }`}
          onBlur={() => {
            const normalized = normalizeDiscoveryWebsiteUrl(value);
            if (normalized !== null) setAnswer(id, normalized);
          }}
        />
      </span>
    ) : field.control === 'date' ? (
      <DiscoveryDateInput
        describedBy={describedBy(field)}
        id={fieldId(field.id)}
        invalid={Boolean(errors[id])}
        label={label}
        onChange={(nextValue) => setAnswer(id, nextValue)}
        value={value}
      />
    ) : (
      <input
        {...commonProps}
        type={field.control === 'text' ? 'text' : field.control}
        minLength={field.minLength}
      />
    );

    return (
      <div key={field.id} className='block min-w-0'>
        <span className='flex items-center'>
          <label htmlFor={fieldId(field.id)} className={fieldLabelClassName}>
            {renderFieldLabel(field, label)}
          </label>
          {renderContextualInfo(field, label)}
        </span>
        {help ? (
          <span id={helpId(field.id)} className='mt-1 block text-sm leading-relaxed text-fg/60'>
            {help}
          </span>
        ) : null}
        {input}
        {renderError(field)}
      </div>
    );
  };

  const reviewValue = (field: DiscoveryQuestionnaireField) => {
    const answer = answers[field.id as DiscoveryQuestionnaireFieldId];
    if (Array.isArray(answer)) {
      return answer.length
        ? answer.map((option) => t(`options.${field.id}.${option}`)).join(', ')
        : t('review.notProvided');
    }
    if (typeof answer === 'boolean') return answer ? t('review.confirmed') : t('review.notProvided');
    if (!answer.trim()) return t('review.notProvided');
    if (field.control === 'date') {
      const date = parseDiscoveryDateOnly(answer);
      return date ? formatDiscoveryDateDisplay(date) : answer;
    }
    const option = field.options?.find((candidate) => candidate.id === answer);
    return option ? t(`options.${field.id}.${option.id}`) : answer;
  };

  const reviewFields = discoveryQuestionnaireFields.filter(
    (field) =>
      field.source === 'approved-brief' &&
      isDiscoveryQuestionnaireFieldVisible(field, answers),
  ) as readonly DiscoveryQuestionnaireField[];

  const progress = Math.round(
    (highestStepReached / discoveryQuestionnaireSteps.length) * 100,
  );

  if (confirmation) {
    return <SubmissionConfirmation confirmation={confirmation} locale={locale} />;
  }

  const submissionBusy =
    submission.state.status === 'flushing' ||
    submission.state.status === 'submitting';
  const submissionBlocked =
    Object.keys(submissionErrors).length > 0 ||
    !editingEnabled ||
    persistence.state.status === 'saving' ||
    persistence.state.status === 'offline' ||
    persistence.state.status === 'error' ||
    persistence.state.status === 'disabled' ||
    (submission.state.status !== 'idle' &&
      submission.state.status !== 'validation-error') ||
    submissionBusy;

  return (
    <main className='px-4 pb-16 pt-6 sm:px-6 sm:pt-10'>
      <div className='mx-auto w-full max-w-5xl'>
        <header className='mx-auto max-w-3xl text-center'>
          <p className='font-mono-var text-xs uppercase tracking-[0.2em] text-primary'>
            {t('overline')}
          </p>
          <h1 className='mt-3 text-3xl font-semibold leading-tight sm:text-4xl'>
            {t('title')}
          </h1>
          <p className='mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-fg/70 sm:text-base'>
            {t('intro')}
          </p>
          <p className='mt-3 font-mono-var text-[11px] uppercase tracking-[0.14em] text-fg/45'>
            {t('version', { version: DISCOVERY_QUESTIONNAIRE_VERSION })}
          </p>
        </header>

        <nav className='mt-8' aria-label={t('stepNavigationLabel')}>
          <div className='mb-3 flex items-center justify-between gap-4 text-xs text-fg/60'>
            <span className='font-mono-var uppercase tracking-[0.15em]'>
              {t('stepProgress', { current: currentStep, total: discoveryQuestionnaireSteps.length })}
            </span>
            <span>{progress}%</span>
          </div>
          <div
            role='progressbar'
            aria-valuemin={1}
            aria-valuemax={discoveryQuestionnaireSteps.length}
            aria-valuenow={highestStepReached}
            aria-label={t('progressLabel')}
            className='h-2 overflow-hidden rounded-full bg-surface/70'
          >
            <div
              className='h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none'
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className='mt-4 grid grid-cols-7 gap-1.5' aria-label={t('stepsLabel')}>
            {discoveryQuestionnaireSteps.map((step) => {
              const isCurrent = step.id === currentStep;
              const isAvailable = editingEnabled && step.id <= highestStepReached;
              return (
                <li key={step.id}>
                  <button
                    type='button'
                    disabled={!isAvailable}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={t(
                      isCurrent
                        ? 'navigation.currentStep'
                        : isAvailable
                          ? 'navigation.availableStep'
                          : 'navigation.unavailableStep',
                      { step: t(`steps.${step.id}.short`) },
                    )}
                    onClick={() => navigateToStep(step.id)}
                    className={`min-h-11 w-full rounded-lg border px-1 py-2 text-center font-mono-var text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-2 ${
                      isCurrent
                        ? 'border-primary bg-primary/30 text-primary'
                        : isAvailable
                          ? 'cursor-pointer border-primary/55 bg-surface/85 text-fg hover:bg-primary/15'
                          : 'cursor-not-allowed border-border bg-surface/45 text-fg/40'
                    }`}
                  >
                    <span className='sm:hidden'>{step.id}</span>
                    <span className='hidden sm:inline'>{t(`steps.${step.id}.short`)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {persistence.state.status !== 'disabled' &&
          persistence.state.status !== 'submitted' ? (
            <div className='mt-3'>
              <DiscoverySaveStatus
                status={persistence.state.status}
                canRetry={persistence.state.canRetry}
                onRetry={persistence.retry}
                onResolveConflict={persistence.resolveConflict}
              />
            </div>
          ) : null}
        </nav>

        <form
          className='glass-effect surface-card mt-6 rounded-xl bg-[var(--panel-bg)] p-4 sm:p-6 lg:p-8'
          onSubmit={(event) => event.preventDefault()}
          noValidate
          aria-busy={persistence.state.status === 'initializing'}
        >
          <fieldset disabled={!editingEnabled} className='contents'>
          <div className='border-b border-border/80 pb-5'>
            <h2
              id='discovery-step-heading'
              ref={stepHeadingRef}
              tabIndex={-1}
              className='text-2xl font-semibold outline-none sm:text-3xl'
            >
              {t(`steps.${currentStep}.title`)}
            </h2>
            <p className='mt-2 max-w-3xl text-sm leading-relaxed text-fg/65'>
              {t(`steps.${currentStep}.description`)}
            </p>
          </div>

          <div className='mt-6 space-y-8'>
            {currentSections.map((section) => {
              const sectionFields = currentFields.filter(
                (field) => field.sectionId === section.id && field.source === 'approved-brief',
              ) as readonly DiscoveryQuestionnaireField[];
              return (
                <section
                  key={section.id}
                  aria-labelledby={section.id === '03' ? 'discovery-step-heading' : `section-${section.id}`}
                >
                  {section.id !== '03' ? (
                    <div className='mb-5'>
                      <p className='font-mono-var text-[11px] uppercase tracking-[0.18em] text-primary'>
                        {section.id}
                      </p>
                      <h3 id={`section-${section.id}`} className='mt-1 text-xl font-semibold'>
                        {t(`sections.${section.id}`)}
                      </h3>
                    </div>
                  ) : null}
                  <div className='grid min-w-0 gap-6 md:grid-cols-2'>
                    {sectionFields.map((field) => (
                      <div
                        key={field.id}
                        className={
                          field.control === 'textarea' ||
                          field.control === 'checkbox-group' ||
                          field.control === 'radio-group' ||
                          field.control === 'workflow-confirmation'
                            ? 'min-w-0 md:col-span-2'
                            : 'min-w-0'
                        }
                      >
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {currentStep === 7 ? (
              <section aria-labelledby='discovery-review-heading' className='border-t border-border/80 pt-8'>
                <h3 id='discovery-review-heading' className='text-xl font-semibold'>
                  {t('review.title')}
                </h3>
                <p className='mt-2 text-sm leading-relaxed text-fg/65'>{t('review.description')}</p>
                <dl className='mt-5 grid gap-3 sm:grid-cols-2'>
                  {reviewFields.map((field) => (
                    <div key={field.id} className='min-w-0 rounded-lg border border-border/70 bg-surface/25 p-3'>
                      <dt className='font-mono-var text-[10px] uppercase tracking-[0.14em] text-fg/55'>
                        {t(`fields.${field.id}.label`)}
                      </dt>
                      <dd className='mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/85'>
                        {reviewValue(field)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className='mt-6 rounded-lg border border-[var(--brand-gold)]/50 bg-[var(--brand-gold)]/10 p-4'>
                  <p className='text-sm leading-relaxed'>{t('preliminaryNotice')}</p>
                </div>
                <div className='mt-6'>{renderField(discoveryQuestionnaireFields.at(-1)!)}</div>
                <div
                  id='discovery-submission-status'
                  role='status'
                  aria-live='polite'
                  className='mt-5 rounded-lg border border-border bg-surface/30 p-4'
                >
                  <p className='font-semibold'>
                    {t(`submission.status.${submission.state.status}.title`)}
                  </p>
                  <p className='mt-1 text-sm leading-relaxed text-fg/65'>
                    {t(`submission.status.${submission.state.status}.description`)}
                  </p>
                </div>
                <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                  <Button
                    type='button'
                    onClick={submitQuestionnaire}
                    disabled={submissionBlocked}
                    aria-describedby='discovery-submission-status'
                    className='min-h-11 rounded-lg! disabled:cursor-not-allowed disabled:opacity-40'
                  >
                    {submissionBusy ? t('submission.actions.submitting') : t('submission.actions.submit')}
                  </Button>
                  {submission.state.status === 'ambiguous' || submission.state.status === 'offline' ? (
                    <Button
                      type='button'
                      onClick={() => void submission.retry()}
                      className='min-h-11 rounded-lg!'
                    >
                      {t('submission.actions.retry')}
                    </Button>
                  ) : null}
                  {submission.state.status === 'revision-conflict' ||
                  submission.state.status === 'idempotency-conflict' ? (
                    <Button
                      type='button'
                      onClick={() => window.location.reload()}
                      className='min-h-11 rounded-lg!'
                    >
                      {t('submission.actions.reload')}
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <div className='mt-8 flex flex-col-reverse gap-3 border-t border-border/80 pt-5 sm:flex-row sm:justify-between'>
            <Button
              type='button'
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className='min-h-11 rounded-lg! disabled:cursor-not-allowed disabled:opacity-40'
            >
              {t('navigation.previous')}
            </Button>
            {currentStep < 7 ? (
              <Button type='button' onClick={goToNextStep} className='min-h-11 rounded-lg!'>
                {t('navigation.next')}
              </Button>
            ) : null}
          </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
