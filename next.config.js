/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['neo4j-driver'],
  env: {
    NEO4J_URI: process.env.NEO4J_URI,
    NEO4J_USERNAME: process.env.NEO4J_USERNAME,
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
    NEO4J_DATABASE: process.env.NEO4J_DATABASE,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  // Vercel 部署优化
  poweredByHeader: false,
  compress: true,
  // 图片优化
  images: {
    domains: [],
    unoptimized: true
  }
}

module.exports = nextConfig