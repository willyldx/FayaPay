import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { cn } from "@/lib/utils";


// =============================================================================
// Font Inter — chargée via next/font (optimisé, pas de layout shift)
// =============================================================================

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// =============================================================================
// Metadata SEO
// =============================================================================

export const metadata: Metadata = {
  title: {
    default: 'Kadryza — Dashboard',
    template: '%s | Kadryza',
  },
  description:
    'Gérez vos paiements mobile money, vos clés API et vos webhooks depuis votre espace Kadryza.',
  keywords: ['Kadryza', 'mobile money', 'paiement', 'Tchad', 'API', 'dashboard'],
  robots: {
    index: false, // Dashboard privé — pas d'indexation
    follow: false,
  },
}

// =============================================================================
// Root Layout
// =============================================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
