/* ==================================================
   File: src/components/discovery/DiscoverySaveStatus.tsx
   Project: CodeVivo
   Purpose: Accessible, bilingual autosave status indicator
   for the Project Discovery questionnaire.
   ================================================== */

'use client';

/* ==================================================
   1. Imports
   ================================================== */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleCheck, Loader, WifiOff, CircleAlert } from 'lucide-react';
import {
  createDiscoverySaveStatusPresentation,
  type DiscoverySaveState,
} from '@/lib/discovery/save-status-presentation';

/* ==================================================
   2. Types and Component Props
   Defines the supported persistence states and
   the callback used to retry a failed save.
   ================================================== */

export type { DiscoverySaveState } from '@/lib/discovery/save-status-presentation';

type DiscoverySaveStatusProps = {
  canRetry?: boolean;
  onResolveConflict?: () => void;
  status: DiscoverySaveState;
  onRetry: () => void;
};

/* ==================================================
   3. Status Icons
   Maps each persistence state to its corresponding
   Lucide icon for consistent visual feedback.
   ================================================== */

const statusIcons = {
  conflict: CircleAlert,
  initializing: Loader,
  saved: CircleCheck,
  saving: Loader,
  unsaved: CircleAlert,
  offline: WifiOff,
  error: CircleAlert,
  unavailable: CircleAlert,
};

/* ==================================================
   4. Status Colours
   Neutral colours for routine operations, amber
   for connectivity issues and red for save failures.
   Includes light-theme colour overrides.
   ================================================== */

const statusColours = {
  conflict: 'text-amber-400 [.light_&]:text-amber-800',
  initializing: 'text-fg/60',
  saved: 'text-fg/60',
  saving: 'text-fg/60',
  unsaved: 'text-fg/60',
  offline: 'text-amber-400 [.light_&]:text-amber-800',
  error: 'text-red-400 [.light_&]:text-red-700',
  unavailable: 'text-red-400 [.light_&]:text-red-700',
};

/* ==================================================
   5. Save Status Component
   Presentational component driven by the persistence
   controller. Does not perform database operations
   or independently determine whether data is saved.
   ================================================== */

export default function DiscoverySaveStatus({
  canRetry = false,
  onResolveConflict,
  status,
  onRetry,
}: DiscoverySaveStatusProps) {
  /* Localised status messages */
  const t = useTranslations('discoveryQuestionnaire.saveStatus');
  const [presentation] = useState(() =>
    createDiscoverySaveStatusPresentation({ initialStatus: status }),
  );
  const [presentedStatus, setPresentedStatus] = useState(status);

  useEffect(() => presentation.setup(), [presentation]);
  useEffect(() => presentation.subscribe(setPresentedStatus), [presentation]);
  useEffect(() => {
    presentation.setStatus(status);
  }, [presentation, status]);

  // Safety and editing states always take precedence in the same render. Only
  // an acknowledged `saved` transition may be held behind the presentation timer.
  const visibleStatus = status === 'saved' ? presentedStatus : status;

  /* Resolve the icon for the current persistence state */
  const Icon = statusIcons[visibleStatus];

  return (
    <div
      className={`grid min-h-11 items-center text-xs leading-relaxed ${statusColours[visibleStatus]}`}
    >
      {/* --------------------------------------------------
          Layout Stability
          Reserve space using the longest status message
          to minimise layout shifts when states change.

          The placeholder remains visually hidden and
          excluded from the accessibility tree.
          -------------------------------------------------- */}

      <div
        aria-hidden='true'
        className='invisible pointer-events-none col-start-1 row-start-1 flex items-center justify-end gap-2'
      >
        <WifiOff className='h-4 w-4 shrink-0' />
        <span>{t('offline')}</span>
      </div>

      {/* --------------------------------------------------
          Active Status Indicator
          Right-aligned icon and localised status message.
          -------------------------------------------------- */}

      <div className='col-start-1 row-start-1 flex items-center justify-end gap-2'>
        {/* Status icon
            Animate only while saving and respect the
            user's reduced-motion preferences. */}

        <Icon
          aria-hidden='true'
          className={`h-4 w-4 shrink-0 ${
            visibleStatus === 'saving' || visibleStatus === 'initializing'
              ? 'animate-spin motion-reduce:animate-none'
              : ''
          }`}
        />

        {/* Accessible status announcement
            Communicate state changes to assistive
            technologies without interrupting the user. */}

        <span role='status' aria-live='polite' aria-atomic='true'>
          {t(visibleStatus)}
        </span>

        {/* Retry action
            Available only after a failed save.
            Delegates the retry operation to the
            persistence controller. */}

        {(status === 'error' || status === 'offline') && canRetry && (
          <button
            type='button'
            onClick={onRetry}
            className='min-h-11 shrink-0 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          >
            {t('retry')}
          </button>
        )}
        {status === 'conflict' && onResolveConflict ? (
          <button
            type='button'
            onClick={onResolveConflict}
            className='min-h-11 shrink-0 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          >
            {t('discardAndReload')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
