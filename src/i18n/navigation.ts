// File: src/i18n/navigation.ts
// This file sets up internationalized navigation utilities using next-intl.
// It creates localized versions of Link, redirect, usePathname, useRouter, and getPathname
// based on the routing configuration defined in src/i18n/routing.ts.
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
