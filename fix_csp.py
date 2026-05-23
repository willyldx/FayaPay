content = """/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.kadryza.app',
      },
      {
        protocol: 'https',
        hostname: 'api-kadryza.spencerai.tech',
      },
    ],
  },

  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: true,
      },
    ]
  },

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
              "img-src 'self' data: https://api.kadryza.app https://api-kadryza.spencerai.tech",
              "connect-src 'self' https://api.kadryza.app https://api-kadryza.spencerai.tech",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
"""

with open('/opt/kadryza/kadryza-dashboard/next.config.mjs', 'w') as f:
    f.write(content)

print("OK - next.config.mjs written successfully")
print("connect-src line:")
for line in content.split('\n'):
    if 'connect-src' in line:
        print(line)
