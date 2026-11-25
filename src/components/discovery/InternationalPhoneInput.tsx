'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js/max';
import {
  countryFromInternationalPhoneNumber,
  normalizeDiscoveryPhoneNumber,
  phoneAnswerFromInput,
} from '@/lib/discovery/contact-normalization';

function countryFlag(country: CountryCode) {
  return String.fromCodePoint(
    ...country.split('').map((letter) => letter.charCodeAt(0) + 127397),
  );
}

export default function InternationalPhoneInput({
  country,
  describedBy,
  invalid,
  onChange,
  value,
}: {
  country: CountryCode;
  describedBy?: string;
  invalid: boolean;
  onChange(value: string, country: CountryCode, answer: string): void;
  value: string;
}) {
  const locale = useLocale();
  const t = useTranslations('discoveryQuestionnaire.phone');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
    return getCountries()
      .map((code) => ({
        code,
        dialCode: getCountryCallingCode(code),
        name: displayNames.of(code) ?? code,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [locale]);

  const filteredCountries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(locale).replace(/^\+/u, '');
    if (!term) return countries;
    return countries.filter(
      (candidate) =>
        candidate.name.toLocaleLowerCase(locale).includes(term) ||
        candidate.code.toLocaleLowerCase(locale).includes(term) ||
        candidate.dialCode.includes(term),
    );
  }, [countries, locale, query]);

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

  const updateValue = (nextValue: string) => {
    const detectedCountry = countryFromInternationalPhoneNumber(nextValue) ?? country;
    onChange(
      nextValue,
      detectedCountry,
      phoneAnswerFromInput(nextValue, detectedCountry),
    );
  };

  const normalizeOnBlur = () => {
    const normalized = normalizeDiscoveryPhoneNumber(value, country);
    if (normalized) {
      onChange(normalized, countryFromInternationalPhoneNumber(normalized) ?? country, normalized);
    }
  };

  return (
    <div ref={containerRef} className='relative mt-2 flex min-w-0'>
      <button
        type='button'
        aria-label={t('countrySelector')}
        aria-expanded={open}
        aria-controls='discovery-phone-country-list'
        onClick={() => setOpen((current) => !current)}
        className='brand-border flex min-h-11 shrink-0 items-center gap-1.5 rounded-l-lg border bg-surface/35 px-3 text-sm text-fg transition-colors hover:bg-surface/60 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      >
        <span aria-hidden='true'>{countryFlag(country)}</span>
        <span>+{getCountryCallingCode(country)}</span>
        <ChevronDown className='h-4 w-4 text-fg/60' aria-hidden='true' />
      </button>
      <input
        id='discovery-phone'
        type='tel'
        inputMode='tel'
        autoComplete='tel'
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        onBlur={normalizeOnBlur}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        placeholder={t('placeholder')}
        className='brand-border min-w-0 flex-1 rounded-r-lg border border-l-0 bg-surface/35 px-3 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus-visible:z-10 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      />
      {open ? (
        <div
          id='discovery-phone-country-list'
          className='surface-card fixed inset-x-4 bottom-4 z-40 max-h-[70svh] overflow-hidden rounded-lg bg-surface p-3 shadow-xl sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-80'
        >
          <label className='relative block'>
            <span className='sr-only'>{t('searchLabel')}</span>
            <Search
              className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/50'
              aria-hidden='true'
            />
            <input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              autoFocus
              className='brand-border w-full rounded-lg border bg-surface/60 py-2 pl-9 pr-3 text-sm text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            />
          </label>
          <div className='mt-2 max-h-56 overflow-y-auto' role='listbox' aria-label={t('countryList')}>
            {filteredCountries.map((candidate) => (
              <button
                key={candidate.code}
                type='button'
                role='option'
                aria-selected={candidate.code === country}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  onChange(
                    value,
                    candidate.code,
                    phoneAnswerFromInput(value, candidate.code),
                  );
                }}
                className='flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary'
              >
                <span className='text-lg' aria-hidden='true'>{countryFlag(candidate.code)}</span>
                <span className='min-w-0 flex-1 truncate'>{candidate.name}</span>
                <span className='font-mono-var text-xs text-fg/65'>+{candidate.dialCode}</span>
                {candidate.code === country ? (
                  <Check className='h-4 w-4 text-primary' aria-hidden='true' />
                ) : null}
              </button>
            ))}
            {!filteredCountries.length ? (
              <p className='px-3 py-4 text-sm text-fg/60'>{t('noResults')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
