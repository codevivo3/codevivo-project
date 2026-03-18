import type { Metadata, ResolvingMetadata } from 'next';
import Hero from '@/components/Hero';
import TechStack from '@/components/TechStack';
import FeaturedProjectsPinned from '@/components/pinned/projects/FeaturedProjects';
import WhatIDo from '@/components/WhatIDo';
import WorkWithMe from '@/components/WorkWithMe';
import About from '@/components/About';
import ContactForm from '@/components/ContactForm';

const homeMetadata = {
  en: {
    title: 'CodeVivo — Web Development & Digital Projects',
    description:
      'CodeVivo is the portfolio of Francesco De Vivo, focused on modern web development using React, Next.js, and TypeScript.',
    openGraphDescription:
      'Portfolio of Francesco De Vivo — modern web development with React and Next.js.',
    url: 'https://codevivo.dev',
    locale: 'en_US',
  },
  it: {
    title: 'CodeVivo — Sviluppo Web e Progetti Digitali',
    description:
      'CodeVivo e il portfolio di Francesco De Vivo, focalizzato sullo sviluppo web moderno con React, Next.js e TypeScript.',
    openGraphDescription:
      'Portfolio di Francesco De Vivo — sviluppo web moderno con React e Next.js.',
    url: 'https://codevivo.dev/it',
    locale: 'it_IT',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  const { locale } = await params;
  const currentLocale = locale === 'it' ? homeMetadata.it : homeMetadata.en;
  const parentMetadata = await parent;

  return {
    title: currentLocale.title,
    description: currentLocale.description,
    openGraph: {
      title: 'CodeVivo',
      description: currentLocale.openGraphDescription,
      url: currentLocale.url,
      siteName: 'CodeVivo',
      locale: currentLocale.locale,
      type: 'website',
      images: parentMetadata.openGraph?.images,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'CodeVivo',
      description: currentLocale.openGraphDescription,
      images: parentMetadata.twitter?.images,
    },
  };
}

export default function HomePage() {
  return (
    <>
      <main className='text-fg'>
        <Hero />
        <WhatIDo />
        <TechStack />
        <FeaturedProjectsPinned />
        <WorkWithMe />
        <About />
        <ContactForm />
      </main>
    </>
  );
}
