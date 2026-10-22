import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://codevivo.dev/sitemap.xml',
    host: 'https://codevivo.dev',
  };
}
