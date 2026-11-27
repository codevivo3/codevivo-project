import InvitationEntry from './InvitationEntry';
import { notFound } from 'next/navigation';
import { requireDiscoverySession } from '@/lib/discovery/authorization';
import { isDiscoveryEnabled } from '@/lib/discovery/activation';

export default async function DiscoveryPage() {
  if (!isDiscoveryEnabled(process.env.DISCOVERY_ENABLED)) notFound();
  let initialSessionEstablished = false;
  let invitationId: string | undefined;
  let invitationEmail: string | undefined;
  try {
    const session = await requireDiscoverySession();
    initialSessionEstablished = true;
    invitationId = session.invitationId;
    invitationEmail = session.invitationEmail;
  } catch {
    initialSessionEstablished = false;
  }

  return (
    <InvitationEntry
      initialSessionEstablished={initialSessionEstablished}
      initialPrefill={invitationEmail ? { email: invitationEmail } : undefined}
      stateScopeId={invitationId}
    />
  );
}
