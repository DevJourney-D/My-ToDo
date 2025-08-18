/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },
  transpilePackages: ['recharts'],
  /* config options here */
};

module.exports = nextConfig;
