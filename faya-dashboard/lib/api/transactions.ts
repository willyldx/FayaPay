import { apiClient } from './client'
import type {
  Transaction,
  PaginatedResponse,
  TransactionFilters,
  DashboardStats,
} from '@/lib/types'

// =============================================================================
// Transactions API — /v1/transactions
// =============================================================================

/**
 * Récupère la liste paginée des transactions avec filtres optionnels.
 *
 * GET /v1/transactions?status=SUCCESS&operator=AIRTEL&page=1&per_page=20
 */
export function getTransactions(
  filters: TransactionFilters = {}
): Promise<PaginatedResponse<Transaction>> {
  return apiClient.get<PaginatedResponse<Transaction>>('/transactions', {
    params: {
      status: filters.status,
      operator: filters.operator,
      date_from: filters.date_from,
      date_to: filters.date_to,
      search: filters.search,
      page: filters.page ?? 1,
      per_page: filters.per_page ?? 20,
    },
  })
}

/**
 * Récupère le détail d'une transaction par son ID.
 *
 * GET /v1/transactions/:id
 */
export function getTransaction(id: string): Promise<Transaction> {
  return apiClient.get<Transaction>(`/transactions/${id}`)
}

/**
 * Récupère les statistiques du dashboard (overview).
 *
 * GET /v1/transactions/stats?period=7d
 */
export function getDashboardStats(period: string = '7d'): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/transactions/stats', {
    params: { period },
  })
}

/**
 * Exporte les transactions filtrées au format CSV.
 * Retourne un Blob prêt à être téléchargé.
 *
 * Note : l'export CSV côté client est prioritaire (PRD),
 * mais cette fonction existe si le backend le supporte.
 */
export function exportTransactionsCsv(
  filters: TransactionFilters = {}
): Promise<Blob> {
  // Pour l'export, on utilise fetch directement car le client retourne du JSON
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fayapay.app'
  const url = new URL('/v1/transactions/export', API_BASE_URL)

  if (filters.status) url.searchParams.set('status', filters.status)
  if (filters.operator) url.searchParams.set('operator', filters.operator)
  if (filters.date_from) url.searchParams.set('date_from', filters.date_from)
  if (filters.date_to) url.searchParams.set('date_to', filters.date_to)

  return fetch(url.toString(), {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
  }).then((res) => {
    if (!res.ok) throw new Error(`Export échoué (${res.status})`)
    return res.blob()
  })
}

/**
 * Génère un export CSV côté client à partir de données déjà chargées.
 * Conformément au PRD : export côté client des données en mémoire.
 */
export function generateClientCsv(transactions: Transaction[]): string {
  const headers = [
    'Référence',
    'Montant (XAF)',
    'Opérateur',
    'Téléphone',
    'Statut',
    'Date',
  ]

  const rows = transactions.map((tx) => [
    tx.reference,
    tx.amount.toString(),
    tx.operator,
    tx.phone_number,
    tx.status,
    tx.created_at,
  ])

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\n')

  return csvContent
}

/**
 * Déclenche le téléchargement d'un fichier CSV dans le navigateur.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
