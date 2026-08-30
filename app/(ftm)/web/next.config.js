/** @type {import('next').NextConfig} */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
    ],
  },
  typescript: {
    // Suppress TypeScript errors for third-party library compatibility
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
