import { NextIntlClientProvider } from 'next-intl';
import ClientShell from '@/components/layout/ClientShell';
import { loadMessages } from '@/i18n/loadMessages';

export default function EnglishDiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale='en' messages={loadMessages('en')}>
      <ClientShell>{children}</ClientShell>
    </NextIntlClientProvider>
  );
}
