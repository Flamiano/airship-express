/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // Keep Turbopack scoped to this Next.js app. Without an explicit root,
  // it selects the outer workspace lockfile and mistakes scoped packages
  // such as node_modules/@airship for App Router parallel-route slots.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
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
};

module.exports = nextConfig;
