/**
 * not-found
 *
 * Purpose:
 * Re-exports the locale-aware not-found page for routes outside a resolved locale segment.
 *
 * Context:
 * Used by the app router when a top-level route cannot be matched.
 *
 * Notes:
 * The actual UI lives in the locale-specific file so translated copy stays centralized.
 */

export { default } from './[locale]/not-found';
