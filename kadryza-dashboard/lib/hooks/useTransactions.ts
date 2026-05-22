'use client'

import {
  useQuery,
  useMutation,
  keepPreviousData,
} from '@tanstack/react-query'
import type { TransactionFilters, Transaction } from '@/lib/types'
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
 * @param enabled - Contrôle si la query doit s'exécuter (ex: drawer ouvert)
 */
export function useTransaction(id: string, enabled = true) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
    enabled: !!id && enabled, // [M-2 FIX] Ne pas fetch si le drawer est fermé
  })
}

/**
 * Hook pour exporter les transactions en CSV côté client.
 * Utilise les données déjà en cache si disponibles.
 */
export function useExportTransactions() {
  return useMutation({
    mutationFn: async (filters: TransactionFilters) => {
      // [M-1 FIX] Toujours fetch toutes les transactions pour l'export
      // au lieu d'utiliser le cache paginé (qui ne contient qu'une page)
      const response = await getTransactions({
        ...filters,
        page: 1,
        per_page: 1000, // Max pour l'export
      })
      const transactions = response.data

      const csv = generateClientCsv(transactions)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(csv, `kadryza-transactions-${date}.csv`)
    },
  })
}
