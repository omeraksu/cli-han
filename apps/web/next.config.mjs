/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    HAN_HUB_URL: process.env.HAN_HUB_URL ?? 'http://localhost:3001',
  },
};

export default nextConfig;
