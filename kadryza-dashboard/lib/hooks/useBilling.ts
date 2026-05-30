'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBalance,
  listSettlements,
  createSettlement,
  cancelSettlement,
} from '@/lib/api/billing'
import type { CreateSettlementRequest } from '@/lib/types'
import { toast } from 'sonner'

// =============================================================================
// Query keys
// =============================================================================

export const billingKeys = {
  balance: ['balance'] as const,
  settlements: ['settlements'] as const,
}

// =============================================================================
// Hooks
// =============================================================================

export function useBalance() {
  return useQuery({ queryKey: billingKeys.balance, queryFn: getBalance })
}

export function useSettlements() {
  return useQuery({ queryKey: billingKeys.settlements, queryFn: listSettlements })
}

function invalidateBilling(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: billingKeys.balance })
  queryClient.invalidateQueries({ queryKey: billingKeys.settlements })
}

export function useCreateSettlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSettlementRequest) => createSettlement(data),
    onSuccess: () => {
      invalidateBilling(queryClient)
      toast.success('Demande de retrait enregistrée')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la demande')
    },
  })
}

export function useCancelSettlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelSettlement(id),
    onSuccess: () => {
      invalidateBilling(queryClient)
      toast.success('Retrait annulé')
    },
    onError: () => {
      toast.error("Impossible d'annuler ce retrait")
    },
  })
}
