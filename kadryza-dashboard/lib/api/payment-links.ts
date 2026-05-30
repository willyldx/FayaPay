import { apiClient } from './client'
import type {
  PaymentLink,
  CreatePaymentLinkRequest,
  PaymentLinkListResponse,
} from '@/lib/types'

// =============================================================================
// Payment Links API — /v1/payment-links (JWT)
// =============================================================================

/** Liste les liens de paiement du merchant. */
export function listPaymentLinks(): Promise<PaymentLinkListResponse> {
  return apiClient.get<PaymentLinkListResponse>('/payment-links')
}

/** Crée un nouveau lien de paiement. */
export function createPaymentLink(
  data: CreatePaymentLinkRequest
): Promise<PaymentLink> {
  return apiClient.post<PaymentLink>('/payment-links', data)
}

/** Active ou désactive un lien de paiement. */
export function setPaymentLinkActive(
  id: string,
  isActive: boolean
): Promise<PaymentLink> {
  return apiClient.patch<PaymentLink>(`/payment-links/${id}`, { is_active: isActive })
}

/** Supprime un lien de paiement. */
export function deletePaymentLink(id: string): Promise<void> {
  return apiClient.delete<void>(`/payment-links/${id}`)
}
