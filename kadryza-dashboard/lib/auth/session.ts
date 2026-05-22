// Lecture/écriture du cookie JWT côté serveur (Route Handlers / Server Actions)
// Le cookie est httpOnly — côté client, seul le navigateur y accède.

import { cookies } from 'next/headers'

// =============================================================================
// Configuration
// =============================================================================

const COOKIE_NAME = 'kadryza_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 jours

// =============================================================================
// Fonctions
// =============================================================================

/**
 * Lire le JWT depuis le cookie (côté serveur uniquement).
 * Utilisé dans les Server Components et le middleware.
 */
export async function getToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

/**
 * Écrire le JWT dans un cookie httpOnly sécurisé.
 * Appelé après un login réussi (dans un Route Handler ou Server Action).
 */
export async function setToken(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

/**
 * Supprimer le cookie JWT (déconnexion côté serveur).
 */
export async function removeToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Vérifie si un token JWT est présent (ne valide pas la signature).
 * La validation complète se fait côté backend.
 */
export async function hasToken(): Promise<boolean> {
  const token = await getToken()
  return !!token
}
