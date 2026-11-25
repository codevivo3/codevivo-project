'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from '@daypicker/react';
import { enGB } from '@daypicker/react/locale/en-GB';
import { it } from '@daypicker/react/locale/it';
import '@daypicker/react/style.css';
import {
  discoveryToday,
  formatDiscoveryDateDisplay,
  formatDiscoveryDateOnly,
  parseDiscoveryDateDisplay,
  parseDiscoveryDateOnly,
} from '@/lib/discovery/date-only';

const inputClassName =
  'brand-border w-full rounded-lg border bg-surface/35 px-3 py-3 pr-12 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const CALENDAR_GAP = 8;
const VIEWPORT_MARGIN = 12;

type CalendarPosition = {
  left: number;
  maxHeight: number;
  placement: 'above' | 'below';
  top: number;
};

export default function DiscoveryDateInput({
  describedBy,
  id,
  invalid,
  label,
  onChange,
  value,
}: {
  describedBy?: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  const locale = useLocale();
  const t = useTranslations('discoveryQuestionnaire.calendar');
  const dialogId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const calendarRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selected = useMemo(() => parseDiscoveryDateOnly(value) ?? undefined, [value]);
  const today = useMemo(() => discoveryToday(), []);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(selected ?? today);
  const [position, setPosition] = useState<CalendarPosition | null>(null);
  const calendarLocale = locale === 'it' ? it : enGB;
  const displayValue = selected ? formatDiscoveryDateDisplay(selected) : value;

  const range = useMemo(() => {
    const selectedYear = selected?.getFullYear() ?? today.getFullYear();
    return {
      start: new Date(Math.min(today.getFullYear() - 10, selectedYear), 0, 1, 12),
      end: new Date(Math.max(today.getFullYear() + 15, selectedYear), 11, 1, 12),
    };
  }, [selected, today]);

  useEffect(() => {
    if (!open) return;

    const dismissOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', dismissOnPointerDown);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const positionCalendar = () => {
      const input = inputRef.current;
      const calendar = calendarRef.current;
      if (!input || !calendar) return;

      const inputRect = input.getBoundingClientRect();
      const calendarRect = calendar.getBoundingClientRect();
      const availableBelow = window.innerHeight - inputRect.bottom - CALENDAR_GAP - VIEWPORT_MARGIN;
      const availableAbove = inputRect.top - CALENDAR_GAP - VIEWPORT_MARGIN;
      const placement =
        availableBelow < calendar.scrollHeight && availableAbove > availableBelow
          ? 'above'
          : 'below';
      const availableHeight = Math.max(
        0,
        placement === 'above' ? availableAbove : availableBelow,
      );
      const renderedHeight = Math.min(calendar.scrollHeight, availableHeight);
      const left = Math.min(
        Math.max(inputRect.left, VIEWPORT_MARGIN),
        window.innerWidth - calendarRect.width - VIEWPORT_MARGIN,
      );

      setPosition({
        left: Math.max(VIEWPORT_MARGIN, left),
        maxHeight: availableHeight,
        placement,
        top:
          placement === 'above'
            ? Math.max(VIEWPORT_MARGIN, inputRect.top - CALENDAR_GAP - renderedHeight)
            : inputRect.bottom + CALENDAR_GAP,
      });
    };

    positionCalendar();
    window.addEventListener('resize', positionCalendar);
    window.addEventListener('scroll', positionCalendar, true);
    return () => {
      window.removeEventListener('resize', positionCalendar);
      window.removeEventListener('scroll', positionCalendar, true);
    };
  }, [open]);

  const closeAfterValueChange = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openCalendar = () => {
    setMonth(selected ?? today);
    setPosition(null);
    setOpen(true);
  };

  const calendar = open
    ? createPortal(
        <span
          ref={calendarRef}
          id={dialogId}
          role='dialog'
          aria-label={t('dialogLabel', { field: label })}
          data-placement={position?.placement ?? 'below'}
          style={{
            left: position?.left ?? VIEWPORT_MARGIN,
            maxHeight: position?.maxHeight,
            top: position?.top ?? VIEWPORT_MARGIN,
            visibility: position ? 'visible' : 'hidden',
          }}
          className='discovery-calendar surface-card fixed z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-[var(--brand-gold)]/60 bg-[var(--panel-bg)] p-3 font-sans-var text-fg shadow-xl backdrop-blur-xl'
        >
          <DayPicker
            mode='single'
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              if (date) closeAfterValueChange(formatDiscoveryDateOnly(date));
            }}
            locale={calendarLocale}
            weekStartsOn={1}
            captionLayout='dropdown'
            navLayout='after'
            startMonth={range.start}
            endMonth={range.end}
            showOutsideDays
            fixedWeeks
            autoFocus
            footer={
              selected
                ? t('selected', {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                    }).format(selected),
                  })
                : t('chooseDate')
            }
          />
          <span className='mt-2 flex items-center justify-between gap-2 border-t border-border/80 pt-3'>
            <button
              type='button'
              onClick={() =>
                closeAfterValueChange(formatDiscoveryDateOnly(today))
              }
              className='min-h-10 rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            >
              {t('today')}
            </button>
            <button
              type='button'
              onClick={() => closeAfterValueChange('')}
              className='min-h-10 rounded-lg px-3 text-sm font-medium text-fg/70 transition-colors hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            >
              {t('clear')}
            </button>
          </span>
        </span>,
        document.body,
      )
    : null;

  return (
    <span ref={containerRef} className='relative mt-2 block'>
      <input
        ref={inputRef}
        id={id}
        type='text'
        inputMode='numeric'
        autoComplete='off'
        value={displayValue}
        maxLength={10}
        onChange={(event) => {
          const nextDisplayValue = event.target.value;
          const nextDate = parseDiscoveryDateDisplay(nextDisplayValue);
          onChange(nextDate ? formatDiscoveryDateOnly(nextDate) : nextDisplayValue);
        }}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        placeholder={t('formatPlaceholder')}
        className={inputClassName}
      />
      <button
        ref={triggerRef}
        type='button'
        aria-label={t('open', { field: label })}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className='absolute right-1.5 top-[1.4rem] inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-primary hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      >
        <CalendarDays className='h-5 w-5' aria-hidden='true' />
      </button>

      {calendar}

      <style jsx global>{`
        .discovery-calendar .rdp-root {
          --rdp-accent-color: var(--brand-blue);
          --rdp-accent-background-color: color-mix(in srgb, var(--brand-blue) 18%, transparent);
          --rdp-day-height: clamp(2rem, 10vw, 2.5rem);
          --rdp-day-width: clamp(2rem, 10vw, 2.5rem);
          --rdp-day_button-height: calc(var(--rdp-day-height) - 2px);
          --rdp-day_button-width: calc(var(--rdp-day-width) - 2px);
          --rdp-day_button-border-radius: 0.5rem;
          --rdp-today-color: var(--brand-blue);
          width: 100%;
          font-family: var(--font-sans), sans-serif;
        }
        .discovery-calendar .rdp-months,
        .discovery-calendar .rdp-month,
        .discovery-calendar .rdp-month_grid {
          width: 100%;
          max-width: none;
        }
        .discovery-calendar .rdp-month_grid {
          table-layout: fixed;
        }
        .discovery-calendar .rdp-day,
        .discovery-calendar .rdp-weekday {
          width: calc(100% / 7);
        }
        .discovery-calendar .rdp-day_button {
          margin-inline: auto;
          transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
        }
        .discovery-calendar .rdp-day_button:hover {
          background: color-mix(in srgb, var(--brand-blue) 16%, transparent);
        }
        .discovery-calendar .rdp-day_button:focus-visible,
        .discovery-calendar .rdp-button_previous:focus-visible,
        .discovery-calendar .rdp-button_next:focus-visible,
        .discovery-calendar .rdp-dropdown:focus-visible ~ .rdp-caption_label {
          outline: 2px solid var(--brand-blue);
          outline-offset: 2px;
        }
        .discovery-calendar .rdp-selected .rdp-day_button {
          border-color: var(--brand-blue);
          background: var(--brand-blue);
          color: white;
        }
        .discovery-calendar .rdp-today:not(.rdp-selected) .rdp-day_button {
          border-color: var(--brand-gold);
          color: var(--brand-blue);
          font-weight: 700;
        }
        .discovery-calendar .rdp-outside {
          opacity: 0.42;
        }
        .discovery-calendar .rdp-disabled {
          cursor: not-allowed;
          opacity: 0.35;
        }
        .discovery-calendar .rdp-dropdown_root {
          min-height: 2.25rem;
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          background: color-mix(in srgb, var(--color-surface) 65%, transparent);
          padding-inline: 0.5rem;
        }
        .discovery-calendar .rdp-caption_label {
          font-size: 0.875rem;
        }
        .discovery-calendar .rdp-weekday,
        .discovery-calendar .rdp-footer {
          color: color-mix(in srgb, var(--color-fg) 65%, transparent);
          font-size: 0.75rem;
        }
        .discovery-calendar .rdp-footer {
          padding-top: 0.5rem;
          text-align: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .discovery-calendar .rdp-day_button {
            transition: none;
          }
        }
      `}</style>
    </span>
  );
}
