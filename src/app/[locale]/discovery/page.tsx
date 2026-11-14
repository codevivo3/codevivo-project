import type { Metadata } from 'next';
import InvitationEntry from '@/components/discovery/InvitationEntry';
import { requireDiscoverySession } from '@/lib/discovery/authorization';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'Project Discovery',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function DiscoveryPage() {
  let initialSessionEstablished = false;
  try {
    await requireDiscoverySession();
    initialSessionEstablished = true;
  } catch {
    initialSessionEstablished = false;
  }

  return (
    <InvitationEntry
      initialSessionEstablished={initialSessionEstablished}
    />
  );
}
