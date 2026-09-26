/** @type {import('next').NextConfig} */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const nextConfig = {
  env: {
    NEXT_PUBLIC__FTM_SUPABASE_URL:
      process.env.NEXT_PUBLIC__FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_HR_SUPABASE_URL: process.env.NEXT_PUBLIC_HR_SUPABASE_URL || "",
    NEXT_PUBLIC_HR_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY || "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh4.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh5.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh6.googleusercontent.com",
      },
    ],
  },
  typescript: {
    // Suppress TypeScript errors for third-party library compatibility
    tsconfigPath: "./tsconfig.json",
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
