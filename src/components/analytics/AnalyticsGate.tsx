'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { usePathname } from 'next/navigation';
import { isDiscoveryPath } from '@/lib/discovery/paths';

export default function AnalyticsGate() {
  const pathname = usePathname();
  if (isDiscoveryPath(pathname)) return null;

  return (
    <>
      <GoogleAnalytics gaId='G-9PQ705W0XS' />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
