'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPaymentLinks,
  createPaymentLink,
  setPaymentLinkActive,
  deletePaymentLink,
} from '@/lib/api/payment-links'
import type { CreatePaymentLinkRequest } from '@/lib/types'
import { toast } from 'sonner'

// =============================================================================
// Query keys
// =============================================================================

export const paymentLinkKeys = {
  all: ['payment-links'] as const,
  list: () => [...paymentLinkKeys.all, 'list'] as const,
}

// =============================================================================
// Hooks
// =============================================================================

export function usePaymentLinks() {
  return useQuery({
    queryKey: paymentLinkKeys.list(),
    queryFn: listPaymentLinks,
  })
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePaymentLinkRequest) => createPaymentLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentLinkKeys.all })
      toast.success('Lien de paiement créé')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création')
    },
  })
}

export function useTogglePaymentLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setPaymentLinkActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: paymentLinkKeys.all })
      toast.success(isActive ? 'Lien activé' : 'Lien désactivé')
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du lien')
    },
  })
}

export function useDeletePaymentLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePaymentLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentLinkKeys.all })
      toast.success('Lien supprimé')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du lien')
    },
  })
}
