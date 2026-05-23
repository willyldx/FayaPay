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
 * Le backend supprime le cookie httpOnly dans la réponse.
 *
 * POST /v1/auth/logout
 */
export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout')
}

/**
 * Récupère le profil du merchant connecté.
 *
 * GET /v1/merchants/me
 */
export function getProfile(): Promise<Merchant> {
  return apiClient.get<Merchant>('/auth/me')
}

/**
 * Met à jour le profil du merchant.
 *
 * PATCH /v1/merchants/me
 */
export function updateProfile(
  data: Partial<Pick<Merchant, 'name' | 'email'>>
): Promise<Merchant> {
  return apiClient.patch<Merchant>('/auth/me', data)
}
