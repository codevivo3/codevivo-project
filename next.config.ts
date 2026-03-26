// /codevivo-project/next.config.ts
// Next.js configuration file with custom Webpack setup and next-intl integration
import type { Configuration } from 'webpack';
import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: Configuration) => {
    config.module?.rules?.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
  experimental: {
    serverActions: {},
  },
  turbopack: {}, // Added to avoid Turbopack warning
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
