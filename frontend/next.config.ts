import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ビルド時のESLintチェックをスキップ
  },
  images: {
    domains: ["lh3.googleusercontent.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000', // 開発中のポート
        pathname: '/api/og/review/**',
      },
      {
        protocol: 'https',
        hostname: 'sekirepo.com',
        pathname: '/api/og/review/**',
      },
    ],
  },
};

export default nextConfig;
