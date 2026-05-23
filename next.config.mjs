/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activer le mode strict React pour détecter les problèmes tôt
  reactStrictMode: true,

  // Configuration des images distantes si nécessaire (logos opérateurs, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.kadryza.app',
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "img-src 'self' data: https://api.kadryza.app",
              "connect-src 'self' https://api.kadryza.app",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
