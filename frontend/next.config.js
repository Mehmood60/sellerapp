/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ebayimg.com' },
      { protocol: 'https', hostname: '*.ebayimg.com' },
      { protocol: 'https', hostname: '*.alicdn.com' },
      { protocol: 'https', hostname: '*.aliexpress.com' },
      { protocol: 'https', hostname: '*.dhgate.com' },
      { protocol: 'https', hostname: '*.banggood.com' },
    ],
  },
};

module.exports = nextConfig;
