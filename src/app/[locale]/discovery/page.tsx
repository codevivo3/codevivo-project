import type { Metadata } from 'next';
import DiscoveryPage from '@/components/discovery/DiscoveryPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'Project Discovery',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default DiscoveryPage;
