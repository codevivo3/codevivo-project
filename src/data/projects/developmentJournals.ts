/**
 * Development Journal Metadata
 *
 * Purpose:
 * Stores per-project development journal structure without duplicating project-level metadata.
 *
 * Context:
 * Used by localized `/projects/[slug]/development` pages to resolve entry order and next steps.
 *
 * Notes:
 * - Keep translated copy out of this file; localized text lives in the locale-specific `developmentJournals.json` files under `src/messages`.
 * - Keys must match `journalSlug` values defined in `inProgress.ts`.
 */
export type DevelopmentJournalEntryMeta = {
  slug: string;
  date: string;
  category: string;
};

export type DevelopmentJournalMeta = {
  entries: DevelopmentJournalEntryMeta[];
  nextStepKeys: string[];
};

export const developmentJournals: Record<string, DevelopmentJournalMeta> = {
  nine2fire: {
    entries: [
      {
        slug: 'editorial-system',
        date: '2026-07-05',
        category: 'content',
      },
    ],
    nextStepKeys: [
      'publish-foundation-articles',
      'refine-fire-tracker',
      'prepare-market-launch',
    ],
  },
  decklog: {
    entries: [
      {
        slug: 'product-architecture',
        date: '2026-07-05',
        category: 'architecture',
      },
      {
        slug: 'fleet-explorer',
        date: '2026-07-06',
        category: 'feature',
      },
    ],
    nextStepKeys: [
      'maintenance-workflow',
      'boat-details',
      'issue-reporting',
    ],
  },
};
