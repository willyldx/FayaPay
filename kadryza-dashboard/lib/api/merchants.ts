import { apiClient } from './client'
import type {
  Merchant,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@/lib/types'

// =============================================================================
// Auth & Merchants API — /v1/auth + /v1/merchants
// =============================================================================

/**
 * Connexion du merchant.
 * Le backend set le JWT en httpOnly cookie dans la réponse.
 *
 * POST /v1/auth/login
 */
export function login(data: LoginRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', data)
}

/**
 * Inscription d'un nouveau merchant.
 *
 * POST /v1/auth/register
 */
export function register(data: RegisterRequest): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/register', data)
}

/**
 * Déconnexion — invalide le JWT côté backend.
 *
 * POST /v1/auth/logout
 */
export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout')
}

/**
 * Récupère le profil du merchant connecté.
 *
 * GET /v1/auth/me
 */
export function getProfile(): Promise<Merchant> {
  return apiClient.get<Merchant>('/auth/me')
}

/**
 * Met à jour le profil du merchant.
 *
 * PATCH /v1/auth/me
 */
export function updateProfile(
  data: Partial<Pick<Merchant, 'name' | 'email'>>
): Promise<Merchant> {
  return apiClient.patch<Merchant>('/auth/me', data)
}

/**
 * Demande un email de réinitialisation du mot de passe.
 * Retourne toujours un succès (même si email inexistant) pour la sécurité.
 *
 * POST /v1/auth/forgot-password
 */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/forgot-password', { email })
}

/**
 * Réinitialise le mot de passe avec le token reçu par email.
 *
 * POST /v1/auth/reset-password/:token
 */
export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(`/auth/reset-password/${token}`, { password })
}

/**
 * Vérifie l'email du merchant via le token reçu par mail.
 *
 * GET /v1/auth/verify-email/:token
 */
export function verifyEmail(token: string): Promise<{ message: string }> {
  return apiClient.get<{ message: string }>(`/auth/verify-email/${token}`)
}

/**
 * Renvoie l'email de vérification.
 *
 * POST /v1/auth/resend-verification
 */
export function resendVerification(email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/resend-verification', { email })
}
