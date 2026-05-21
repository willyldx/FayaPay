import { apiClient } from './client'
import type { ApiKey } from '@/lib/types'

// =============================================================================
// API Keys — /v1/api-keys
// =============================================================================

/**
 * Récupère toutes les clés API du merchant.
 * Les clés sont retournées avec leur préfixe tronqué uniquement.
 *
 * GET /v1/api-keys
 */
export function getApiKeys(): Promise<ApiKey[]> {
  return apiClient.get<ApiKey[]>('/api-keys')
}

/**
 * Crée une nouvelle clé API.
 * La clé complète (full_key) est retournée UNE SEULE FOIS dans la réponse.
 *
 * POST /v1/api-keys
 */
export function createApiKey(
  label?: string
): Promise<ApiKey> {
  return apiClient.post<ApiKey>('/api-keys', label ? { label } : undefined)
}

/**
 * Révoque (supprime) une clé API.
 * Action irréversible — la clé ne pourra plus être utilisée.
 *
 * DELETE /v1/api-keys/:id
 */
export function revokeApiKey(id: string): Promise<void> {
  return apiClient.delete<void>(`/api-keys/${id}`)
}
