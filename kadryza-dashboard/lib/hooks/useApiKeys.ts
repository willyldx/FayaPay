'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiKeys, createApiKey, revokeApiKey, generateTestApiKey } from '@/lib/api/api-keys'
import { toast } from 'sonner'

// =============================================================================
// Query Keys
// =============================================================================

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Liste des clés API du merchant (préfixes tronqués uniquement).
 */
export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: getApiKeys,
  })
}

/**
 * Création d'une nouvelle clé API.
 * La clé complète n'est disponible qu'une seule fois dans le résultat.
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (label?: string) => createApiKey(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
      // Pas de toast ici — le modal affiche la clé complète
    },
    onError: () => {
      toast.error('Erreur lors de la création de la clé API')
    },
  })
}

/**
 * Révocation d'une clé API (irréversible).
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
      toast.success('Clé API révoquée')
    },
    onError: () => {
      toast.error('Erreur lors de la révocation de la clé')
    },
  })
}

/**
 * Génère (ou régénère) la clé API de test (sandbox).
 * La clé complète n'est disponible qu'une seule fois dans le résultat.
 */
export function useGenerateTestApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => generateTestApiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
    },
    onError: () => {
      toast.error('Erreur lors de la génération de la clé de test')
    },
  })
}
