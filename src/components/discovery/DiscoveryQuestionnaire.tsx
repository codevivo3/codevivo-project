'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import {
  createDiscoveryQuestionnaireAnswers,
  getDiscoveryQuestionnaireStepFields,
  isDiscoveryQuestionnaireFieldVisible,
  toggleDiscoveryQuestionnaireOption,
  updateDiscoveryQuestionnaireAnswer,
  validateDiscoveryQuestionnaireStep,
  type DiscoveryQuestionnaireAnswers,
  type DiscoveryQuestionnaireErrors,
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

const fieldLabelClassName =
  'font-mono-var text-[11px] font-medium uppercase tracking-[0.18em] text-fg/70';
const inputClassName =
  'brand-border mt-2 w-full rounded-md border bg-surface/35 px-3 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const choiceClassName =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-surface/25 px-3 py-2.5 text-sm leading-relaxed text-fg transition-colors hover:border-primary/60 focus-within:border-primary';

function fieldId(id: string) {
  return `discovery-${id}`;
}

function errorId(id: string) {
  return `${fieldId(id)}-error`;
}

function helpId(id: string) {
  return `${fieldId(id)}-help`;
}

export default function DiscoveryQuestionnaire() {
  const t = useTranslations('discoveryQuestionnaire');
  const [answers, setAnswers] = useState<DiscoveryQuestionnaireAnswers>(
    createDiscoveryQuestionnaireAnswers,
  );
  const [currentStep, setCurrentStep] = useState<DiscoveryQuestionnaireStep>(1);
  const [errors, setErrors] = useState<DiscoveryQuestionnaireErrors>({});
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const currentFields = useMemo(
    () => getDiscoveryQuestionnaireStepFields(currentStep, answers),
    [answers, currentStep],
  );
  const currentSections = discoveryQuestionnaireSections.filter(
    (section) => section.step === currentStep,
  );

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

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
      setCurrentStep((currentStep + 1) as DiscoveryQuestionnaireStep);
    }
  };

  const goToPreviousStep = () => {
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as DiscoveryQuestionnaireStep);
    }
  };

  const describedBy = (field: DiscoveryQuestionnaireField) =>
    [helpId(field.id), errors[field.id as DiscoveryQuestionnaireFieldId]
      ? errorId(field.id)
      : null]
      .filter(Boolean)
      .join(' ');

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
    const help = t(`fields.${field.id}.help`);
    const requiredLabel = field.required ? t('required') : t('optional');

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
          <p id={helpId(field.id)} className='mt-2 text-xs leading-relaxed text-fg/60'>
            {help}
          </p>
          {renderError(field)}
        </div>
      );
    }

    if (field.control === 'radio-group' || field.control === 'checkbox-group') {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <fieldset key={field.id} className='min-w-0'>
          <legend className={fieldLabelClassName}>
            {label} <span className='normal-case tracking-normal text-fg/45'>({requiredLabel})</span>
          </legend>
          <p id={helpId(field.id)} className='mt-1 text-sm leading-relaxed text-fg/60'>
            {help}
          </p>
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
        <label key={field.id} htmlFor={fieldId(field.id)} className='block min-w-0'>
          <span className={fieldLabelClassName}>
            {label} <span className='normal-case tracking-normal text-fg/45'>({requiredLabel})</span>
          </span>
          <span id={helpId(field.id)} className='mt-1 block text-sm leading-relaxed text-fg/60'>
            {help}
          </span>
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
        </label>
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
    };

    return (
      <label key={field.id} htmlFor={fieldId(field.id)} className='block min-w-0'>
        <span className={fieldLabelClassName}>
          {label} <span className='normal-case tracking-normal text-fg/45'>({requiredLabel})</span>
        </span>
        <span id={helpId(field.id)} className='mt-1 block text-sm leading-relaxed text-fg/60'>
          {help}
        </span>
        {field.control === 'textarea' ? (
          <textarea {...commonProps} rows={4} minLength={field.minLength} />
        ) : (
          <input
            {...commonProps}
            type={field.control === 'text' ? 'text' : field.control}
            minLength={field.minLength}
          />
        )}
        {renderError(field)}
      </label>
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
    const option = field.options?.find((candidate) => candidate.id === answer);
    return option ? t(`options.${field.id}.${option.id}`) : answer;
  };

  const reviewFields = discoveryQuestionnaireFields.filter(
    (field) =>
      field.source === 'approved-brief' &&
      isDiscoveryQuestionnaireFieldVisible(field, answers),
  ) as readonly DiscoveryQuestionnaireField[];

  const progress = Math.round((currentStep / discoveryQuestionnaireSteps.length) * 100);

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
            aria-valuenow={currentStep}
            aria-label={t('progressLabel')}
            className='h-2 overflow-hidden rounded-full bg-surface/70'
          >
            <div
              className='h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none'
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className='mt-4 grid grid-cols-7 gap-1.5' aria-label={t('stepsLabel')}>
            {discoveryQuestionnaireSteps.map((step) => (
              <li
                key={step.id}
                aria-current={step.id === currentStep ? 'step' : undefined}
                className={`rounded-md border px-1 py-2 text-center font-mono-var text-[10px] sm:px-2 ${
                  step.id === currentStep
                    ? 'border-primary bg-primary/15 text-primary'
                    : step.id < currentStep
                      ? 'border-primary/40 text-fg/70'
                      : 'border-border text-fg/40'
                }`}
              >
                <span className='sm:hidden'>{step.id}</span>
                <span className='hidden sm:inline'>{t(`steps.${step.id}.short`)}</span>
              </li>
            ))}
          </ol>
        </nav>

        <form
          className='glass-effect surface-card mt-6 rounded-xl bg-[var(--panel-bg)] p-4 sm:p-6 lg:p-8'
          onSubmit={(event) => event.preventDefault()}
          noValidate
        >
          <div className='border-b border-border/80 pb-5'>
            <p className='font-mono-var text-xs uppercase tracking-[0.18em] text-fg/55'>
              {t('stepProgress', { current: currentStep, total: discoveryQuestionnaireSteps.length })}
            </p>
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className='mt-2 text-2xl font-semibold outline-none sm:text-3xl'
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
                <section key={section.id} aria-labelledby={`section-${section.id}`}>
                  <div className='mb-5'>
                    <p className='font-mono-var text-[11px] uppercase tracking-[0.18em] text-primary'>
                      {section.id}
                    </p>
                    <h3 id={`section-${section.id}`} className='mt-1 text-xl font-semibold'>
                      {t(`sections.${section.id}`)}
                    </h3>
                  </div>
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
                <div id='discovery-submission-unavailable' className='mt-5 rounded-lg border border-border bg-surface/30 p-4'>
                  <p className='font-semibold'>{t('submissionUnavailable.title')}</p>
                  <p className='mt-1 text-sm leading-relaxed text-fg/65'>
                    {t('submissionUnavailable.description')}
                  </p>
                </div>
                <button
                  type='button'
                  disabled
                  aria-describedby='discovery-submission-unavailable'
                  className='mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-surface/40 px-4 py-2 text-sm font-semibold text-fg/45 sm:w-auto'
                >
                  {t('submissionUnavailable.action')}
                </button>
              </section>
            ) : null}
          </div>

          <div className='mt-8 flex flex-col-reverse gap-3 border-t border-border/80 pt-5 sm:flex-row sm:justify-between'>
            <Button
              type='button'
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className='min-h-11 disabled:cursor-not-allowed disabled:opacity-40'
            >
              {t('navigation.previous')}
            </Button>
            {currentStep < 7 ? (
              <Button type='button' onClick={goToNextStep} className='min-h-11'>
                {t('navigation.next')}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
