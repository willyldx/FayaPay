'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type { TransactionFilters, Transaction, PaginatedResponse } from '@/lib/types'
import {
  getTransactions,
  getTransaction,
  generateClientCsv,
  downloadCsv,
} from '@/lib/api/transactions'

// =============================================================================
// Query Keys
// =============================================================================

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) =>
    [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Liste paginée des transactions avec filtres.
 * Garde les données précédentes pendant le chargement de la page suivante
 * pour éviter les flashs de contenu vide.
 */
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => getTransactions(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000, // 30s avant de considérer les données périmées
  })
}

/**
 * Détail d'une transaction par ID.
 */
export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
    enabled: !!id,
  })
}

/**
 * Hook pour exporter les transactions en CSV côté client.
 * Utilise les données déjà en cache si disponibles.
 */
export function useExportTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filters: TransactionFilters) => {
      // Tenter de récupérer les données du cache TanStack Query
      const cached = queryClient.getQueryData<PaginatedResponse<Transaction>>(
        transactionKeys.list(filters)
      )

      let transactions: Transaction[]

      if (cached) {
        transactions = cached.data
      } else {
        // Si pas en cache, fetch depuis l'API
        const response = await getTransactions({
          ...filters,
          per_page: 1000, // Max pour l'export
        })
        transactions = response.data
      }

      const csv = generateClientCsv(transactions)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(csv, `fayapay-transactions-${date}.csv`)
    },
  })
}
