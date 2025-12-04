/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost', process.env.VERCEL_URL || ''],
    },
  },
};

export default nextConfig;
