/**
 * HomePage
 *
 * Purpose:
 * Composes the localized homepage sections and exports locale-aware metadata.
 *
 * Context:
 * Main landing page for each supported locale.
 *
 * Dependencies:
 * - shared homepage sections from `src/components`
 * - Next.js metadata APIs for per-locale SEO output
 * - locale-specific copy selected from the local metadata map
 *
 * Notes:
 * - Keep section ordering here; individual sections should remain presentation-focused.
 * - Metadata fallback behavior depends on the locale keys defined in `homeMetadata`.
 */
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
    title: 'CodeVivo — Francesco De Vivo | Web Developer',
    description:
      'Francesco De Vivo is the developer behind CodeVivo, creating professional websites and custom web applications with React and Next.js.',
    openGraphDescription:
      'Francesco De Vivo is the developer behind CodeVivo, creating professional websites and custom web applications with React and Next.js.',
    url: 'https://codevivo.dev/en',
    locale: 'en_US',
  },
  it: {
    title: 'CodeVivo — Francesco De Vivo | Sviluppatore Web',
    description:
      'Francesco De Vivo è lo sviluppatore di CodeVivo. Realizza siti web professionali e applicazioni web su misura con React e Next.js.',
    openGraphDescription:
      'Francesco De Vivo è lo sviluppatore di CodeVivo. Realizza siti web professionali e applicazioni web su misura con React e Next.js.',
    url: 'https://codevivo.dev/it',
    locale: 'it_IT',
  },
} as const;

const homepageStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': 'https://codevivo.dev/#person',
      name: 'Francesco De Vivo',
      url: 'https://codevivo.dev',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://codevivo.dev/#website',
      name: 'CodeVivo',
      url: 'https://codevivo.dev',
      creator: {
        '@id': 'https://codevivo.dev/#person',
      },
    },
  ],
}).replace(/</g, '\\u003c');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}, parent: ResolvingMetadata): Promise<Metadata> {
  // Derived values
  const { locale } = await params;
  // Resolve a stable metadata set per supported locale before merging parent images.
  const normalizedLocale = locale === 'it' ? 'it' : 'en';
  const currentLocale = homeMetadata[normalizedLocale];
  const parentMetadata = await parent;

  return {
    title: {
      absolute: currentLocale.title,
    },
    description: currentLocale.description,
    alternates: {
      canonical: `/${normalizedLocale}`,
      languages: {
        en: '/en',
        it: '/it',
        'x-default': '/',
      },
    },
    openGraph: {
      title: currentLocale.title,
      description: currentLocale.openGraphDescription,
      url: currentLocale.url,
      siteName: 'CodeVivo',
      locale: currentLocale.locale,
      type: 'website',
      images: parentMetadata.openGraph?.images,
    },
    twitter: {
      card: 'summary_large_image',
      title: currentLocale.title,
      description: currentLocale.openGraphDescription,
      images: parentMetadata.twitter?.images,
    },
  };
}

export default function HomePage() {
  // Render
  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: homepageStructuredData }}
      />
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
