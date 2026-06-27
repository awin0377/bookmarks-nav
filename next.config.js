/** @type {import('next').NextConfig} */
const nextConfig = {
  // @neondatabase/serverless 是 ESM 包，Next.js 打包时会损坏其内部导出
  // 标记为外部包，运行时直接加载 node_modules 原始文件
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: '**.ico' },
      { protocol: 'https', hostname: '**.png' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
