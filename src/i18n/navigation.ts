/**
 * i18n Navigation
 *
 * Purpose:
 * Exposes locale-aware navigation helpers derived from the shared routing configuration.
 *
 * Context:
 * Imported anywhere the app needs localized links or client navigation utilities.
 *
 * Dependencies:
 * - next-intl navigation helpers
 * - route definitions from `src/i18n/routing.ts`
 *
 * Notes:
 * - Keep all locale-aware navigation helpers sourced from the same routing config.
 * - If supported locales change, this file updates automatically through `routing`.
 */
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
