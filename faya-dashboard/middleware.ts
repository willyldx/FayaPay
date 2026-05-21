import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// =============================================================================
// Middleware Next.js — Protection des routes
// =============================================================================

// Routes publiques (pas de JWT requis)
const PUBLIC_ROUTES = ['/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lire le cookie JWT (le nom du cookie doit correspondre à celui du backend)
  const token = request.cookies.get('fayapay_token')?.value

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // --- Utilisateur NON authentifié sur route protégée → redirect /login ---
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    // Conserver l'URL d'origine pour redirect après login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // --- Utilisateur authentifié sur /login ou /register → redirect / ---
  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Matcher : appliquer le middleware à toutes les routes sauf les assets
export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     * - fichiers publics (images, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
