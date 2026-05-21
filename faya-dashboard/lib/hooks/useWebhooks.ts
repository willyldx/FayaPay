'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  testWebhook,
} from '@/lib/api/webhooks'
import type { CreateWebhookRequest } from '@/lib/types'
import { toast } from 'sonner'

// =============================================================================
// Query Keys
// =============================================================================

export const webhookKeys = {
  all: ['webhooks'] as const,
  list: () => [...webhookKeys.all, 'list'] as const,
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Liste de tous les endpoints webhook du merchant.
 */
export function useWebhooks() {
  return useQuery({
    queryKey: webhookKeys.list(),
    queryFn: getWebhooks,
  })
}

/**
 * Création d'un webhook.
 * Invalide le cache après succès.
 */
export function useCreateWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateWebhookRequest) => createWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all })
      toast.success('Webhook créé avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de la création du webhook')
    },
  })
}

/**
 * Suppression d'un webhook.
 * Invalide le cache après succès.
 */
export function useDeleteWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all })
      toast.success('Webhook supprimé')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du webhook')
    },
  })
}

/**
 * Active/désactive un webhook.
 */
export function useToggleWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleWebhook(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all })
      toast.success(isActive ? 'Webhook activé' : 'Webhook désactivé')
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du webhook')
    },
  })
}

/**
 * Test d'un webhook (envoi de payload fictif).
 */
export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => testWebhook(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          `Test réussi — ${result.status_code} en ${result.response_time_ms}ms`
        )
      } else {
        toast.error(`Test échoué — ${result.error ?? 'Erreur inconnue'}`)
      }
    },
    onError: () => {
      toast.error('Impossible d\'envoyer le test')
    },
  })
}
