import { apiClient, getAuthToken, KadryzaApiError } from './client'
import type {
  ApiError,
  KYCDocument,
  KYCDocumentType,
  KYCStatusResponse,
  UpdateKYCProfileRequest,
} from '@/lib/types'

// =============================================================================
// KYC — /v1/kyc (JWT protégé)
//
// Contrat API réel : succès renvoie le JSON brut (pas d'enveloppe {data}),
// 204 = pas de body, erreurs plates { error, code }.
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.kadryza.app'

/**
 * Récupère la vue agrégée du KYC (profil business + documents + statut).
 *
 * GET /v1/kyc/status
 */
export function getKYCStatus(): Promise<KYCStatusResponse> {
  return apiClient.get<KYCStatusResponse>('/kyc/status')
}

/**
 * Met à jour le profil business (sémantique PATCH — seuls les champs fournis
 * sont appliqués).
 *
 * PATCH /v1/kyc/profile
 */
export function updateKYCProfile(body: UpdateKYCProfileRequest): Promise<unknown> {
  return apiClient.patch<unknown>('/kyc/profile', body)
}

/**
 * Supprime un document uploadé (uniquement tant que le KYC n'est pas vérifié).
 *
 * DELETE /v1/kyc/documents/:id
 */
export function deleteKYCDocument(id: string): Promise<void> {
  return apiClient.delete<void>(`/kyc/documents/${id}`)
}

/**
 * Soumet le dossier KYC à l'examen (passe le statut à 'pending').
 * Nécessite un profil complet (business_type + legal_name) et ≥ 1 document.
 *
 * POST /v1/kyc/submit
 */
export function submitKYC(): Promise<unknown> {
  return apiClient.post<unknown>('/kyc/submit')
}

/**
 * Upload d'un document KYC en multipart/form-data.
 *
 * `apiClient` sérialise le body en JSON ; on utilise donc `fetch` directement
 * avec un `FormData`. On ne fixe PAS le Content-Type : le navigateur ajoute
 * automatiquement le boundary multipart correct.
 *
 * POST /v1/kyc/documents  (champs : doc_type, file)
 */
export async function uploadKYCDocument(
  docType: KYCDocumentType,
  file: File
): Promise<KYCDocument> {
  const form = new FormData()
  form.append('doc_type', docType)
  form.append('file', file)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/v1/kyc/documents`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new KadryzaApiError('Session expirée', 401, 'UNAUTHORIZED')
    }

    let apiError: ApiError | null = null
    try {
      apiError = (await response.json()) as ApiError
    } catch {
      // body non-JSON
    }

    throw new KadryzaApiError(
      apiError?.error ?? `Erreur HTTP ${response.status}`,
      response.status,
      apiError?.code ?? `HTTP_${response.status}`
    )
  }

  return response.json() as Promise<KYCDocument>
}
