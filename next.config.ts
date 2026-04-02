import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 生产环境输出独立部署包
  output: 'standalone',
  
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
