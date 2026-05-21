import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activer le mode strict React pour détecter les problèmes tôt
  reactStrictMode: true,

  // Configuration des images distantes si nécessaire (logos opérateurs, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.fayapay.app',
      },
    ],
  },

  // Redirections par défaut
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: true,
      },
    ]
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
