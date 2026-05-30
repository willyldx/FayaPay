import { apiClient } from './client'
import type {
  CheckoutView,
  CheckoutTransactionStatus,
  CheckoutPayResponse,
} from '@/lib/types'

// =============================================================================
// Public Checkout API — /v1/checkout (no auth)
// =============================================================================

/** Récupère la vue publique d'un lien de paiement par son slug. */
export function getCheckout(slug: string): Promise<CheckoutView> {
  return apiClient.get<CheckoutView>(`/checkout/${slug}`)
}

/** Initie un paiement mobile money pour un lien de paiement. */
export function payCheckout(
  slug: string,
  data: { phone_number: string; operator: string }
): Promise<CheckoutPayResponse> {
  return apiClient.post<CheckoutPayResponse>(`/checkout/${slug}/pay`, data)
}

/** Récupère le statut public d'une transaction de checkout (polling). */
export function getCheckoutStatus(
  txId: string
): Promise<CheckoutTransactionStatus> {
  return apiClient.get<CheckoutTransactionStatus>(`/checkout/tx/${txId}`)
}
