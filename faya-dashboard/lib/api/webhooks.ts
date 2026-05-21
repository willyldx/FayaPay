import { apiClient } from './client'
import type {
  WebhookEndpoint,
  CreateWebhookRequest,
  WebhookTestResult,
} from '@/lib/types'

// =============================================================================
// Webhooks API — /v1/webhooks
// =============================================================================

/**
 * Récupère tous les endpoints webhook du merchant.
 *
 * GET /v1/webhooks
 */
export function getWebhooks(): Promise<WebhookEndpoint[]> {
  return apiClient.get<WebhookEndpoint[]>('/webhooks')
}

/**
 * Crée un nouvel endpoint webhook.
 * Le secret est retourné UNE SEULE FOIS dans la réponse.
 *
 * POST /v1/webhooks
 */
export function createWebhook(data: CreateWebhookRequest): Promise<WebhookEndpoint> {
  return apiClient.post<WebhookEndpoint>('/webhooks', data)
}

/**
 * Supprime un endpoint webhook.
 *
 * DELETE /v1/webhooks/:id
 */
export function deleteWebhook(id: string): Promise<void> {
  return apiClient.delete<void>(`/webhooks/${id}`)
}

/**
 * Active ou désactive un endpoint webhook.
 *
 * PATCH /v1/webhooks/:id
 */
export function toggleWebhook(
  id: string,
  isActive: boolean
): Promise<WebhookEndpoint> {
  return apiClient.patch<WebhookEndpoint>(`/webhooks/${id}`, {
    is_active: isActive,
  })
}

/**
 * Envoie un payload de test vers l'endpoint webhook.
 * Retourne le résultat HTTP (status code, temps de réponse).
 *
 * POST /v1/webhooks/:id/test
 */
export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiClient.post<WebhookTestResult>(`/webhooks/${id}/test`)
}
