/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote intern photos from any host (optional field in the PRD).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Server Actions default to a 1MB request body — too small for a log
    // entry with several screenshots. Raise it to just under Vercel's ~4.5MB
    // serverless request-body ceiling.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
