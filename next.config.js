/** @type {import('next').NextConfig} */
  const nextConfig = {
    experimental: {
      serverComponentsExternalPackages: ['neo4j-driver'],
    },
    env: {
      NEO4J_URI: process.env.NEO4J_URI,
      NEO4J_USERNAME: process.env.NEO4J_USERNAME,
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
      NEO4J_DATABASE: process.env.NEO4J_DATABASE,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    },
    poweredByHeader: false,
    compress: true,
    images: {
      domains: [],
      unoptimized: true
    }
  }

  module.exports = nextConfig