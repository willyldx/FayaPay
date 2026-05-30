import { apiClient } from './client'
import type {
  Balance,
  Settlement,
  CreateSettlementRequest,
  SettlementListResponse,
} from '@/lib/types'

// =============================================================================
// Billing API — /v1/balance + /v1/settlements (JWT)
// =============================================================================

/** Aperçu du solde du marchand. */
export function getBalance(): Promise<Balance> {
  return apiClient.get<Balance>('/balance')
}

/** Historique des reversements. */
export function listSettlements(): Promise<SettlementListResponse> {
  return apiClient.get<SettlementListResponse>('/settlements')
}

/** Demande un retrait. */
export function createSettlement(
  data: CreateSettlementRequest
): Promise<Settlement> {
  return apiClient.post<Settlement>('/settlements', data)
}

/** Annule un retrait en attente. */
export function cancelSettlement(id: string): Promise<Settlement> {
  return apiClient.post<Settlement>(`/settlements/${id}/cancel`)
}
