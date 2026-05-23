import { apiClient } from './client'
import type {
  WebhookEndpoint,
  CreateWebhookRequest,
  WebhookTestResult,
} from '@/lib/types'

// =============================================================================
// Webhooks API — /v1/dashboard/webhooks (JWT protected)
// =============================================================================

/**
 * Récupère tous les endpoints webhook du merchant.
 *
 * GET /v1/dashboard/webhooks
 */
export function getWebhooks(): Promise<WebhookEndpoint[]> {
  return apiClient
    .get<{ endpoints: WebhookEndpoint[] }>('/dashboard/webhooks')
    .then((res) => res.endpoints)
}

/**
 * Crée un nouvel endpoint webhook.
 * Le secret est retourné UNE SEULE FOIS dans la réponse.
 *
 * POST /v1/dashboard/webhooks
 */
export function createWebhook(data: CreateWebhookRequest): Promise<WebhookEndpoint> {
  return apiClient.post<WebhookEndpoint>('/dashboard/webhooks', data)
}

/**
 * Supprime un endpoint webhook.
 *
 * DELETE /v1/dashboard/webhooks/:id
 */
export function deleteWebhook(id: string): Promise<void> {
  return apiClient.delete<void>(`/dashboard/webhooks/${id}`)
}

/**
 * Active ou désactive un endpoint webhook.
 *
 * PATCH /v1/dashboard/webhooks/:id
 */
export function toggleWebhook(
  id: string,
  isActive: boolean
): Promise<WebhookEndpoint> {
  return apiClient.patch<WebhookEndpoint>(`/dashboard/webhooks/${id}`, {
    is_active: isActive,
  })
}

/**
 * Envoie un payload de test vers l'endpoint webhook.
 * Retourne le résultat HTTP (status code, temps de réponse).
 *
 * POST /v1/dashboard/webhooks/:id/test
 */
export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiClient.post<WebhookTestResult>(`/dashboard/webhooks/${id}/test`)
}
