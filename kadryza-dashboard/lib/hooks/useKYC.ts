'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteKYCDocument,
  getKYCStatus,
  submitKYC,
  updateKYCProfile,
  uploadKYCDocument,
} from '@/lib/api/kyc'
import { KadryzaApiError } from '@/lib/api/client'
import type { KYCDocumentType, UpdateKYCProfileRequest } from '@/lib/types'

// =============================================================================
// Query Keys
// =============================================================================

export const kycKeys = {
  all: ['kyc'] as const,
  status: () => [...kycKeys.all, 'status'] as const,
}

// =============================================================================
// Hooks
// =============================================================================

/** Statut KYC agrégé (profil + documents). */
export function useKYCStatus() {
  return useQuery({
    queryKey: kycKeys.status(),
    queryFn: getKYCStatus,
  })
}

/** Mise à jour du profil business. */
export function useUpdateKYCProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateKYCProfileRequest) => updateKYCProfile(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycKeys.all })
      toast.success('Profil enregistré')
    },
    onError: (err) => {
      toast.error(err instanceof KadryzaApiError ? err.message : 'Erreur lors de l\'enregistrement du profil')
    },
  })
}

/** Upload d'un document KYC. */
export function useUploadKYCDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ docType, file }: { docType: KYCDocumentType; file: File }) =>
      uploadKYCDocument(docType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycKeys.all })
      toast.success('Document ajouté')
    },
    onError: (err) => {
      toast.error(err instanceof KadryzaApiError ? err.message : 'Échec de l\'upload du document')
    },
  })
}

/** Suppression d'un document KYC. */
export function useDeleteKYCDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteKYCDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycKeys.all })
      toast.success('Document supprimé')
    },
    onError: (err) => {
      toast.error(err instanceof KadryzaApiError ? err.message : 'Échec de la suppression')
    },
  })
}

/** Soumission du dossier KYC à l'examen. */
export function useSubmitKYC() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => submitKYC(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycKeys.all })
      toast.success('Dossier soumis — vérification en cours')
    },
    onError: (err) => {
      toast.error(err instanceof KadryzaApiError ? err.message : 'Échec de la soumission du dossier')
    },
  })
}
