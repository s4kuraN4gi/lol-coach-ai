import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // 100MB in bytes (for large video frame payloads)
      bodySizeLimit: 100 * 1024 * 1024,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
        pathname: '/cdn/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.communitydragon.org',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
