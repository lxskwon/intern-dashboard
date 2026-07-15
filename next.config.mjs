/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote intern photos from any host (optional field in the PRD).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
