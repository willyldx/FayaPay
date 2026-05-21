'use client'

import { useState, useCallback } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { TransactionFilters as TxFilters, DatePreset } from '@/lib/types'
import { useTransactions, useExportTransactions } from '@/lib/hooks/useTransactions'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { TransactionFilters } from '@/components/transactions/TransactionFilters'
import { TransactionDetail } from '@/components/transactions/TransactionDetail'

// =============================================================================
// Page Transactions — Liste paginée + filtres + export
// =============================================================================

export default function TransactionsPage() {
  // --- Filtres ---
  const [filters, setFilters] = useState<TxFilters>({
    page: 1,
    per_page: 20,
  })

  // --- Drawer détail ---
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)

  // --- Requête ---
  const { data, isLoading, isFetching } = useTransactions(filters)

  // --- Export CSV ---
  const exportMutation = useExportTransactions()

  // --- Handlers ---
  const handleFilterChange = useCallback((newFilters: Partial<TxFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset page quand un filtre change
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handleReset = useCallback(() => {
    setFilters({ page: 1, per_page: 20 })
  }, [])

  const totalPages = data ? Math.ceil(data.total / (filters.per_page ?? 20)) : 0

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${new Intl.NumberFormat('fr-FR').format(data.total)} transaction${data.total > 1 ? 's' : ''} au total`
              : 'Chargement…'}
          </p>
        </div>

        {/* Export CSV */}
        <button
          onClick={() => exportMutation.mutate(filters)}
          disabled={exportMutation.isPending || !data?.data.length}
          className="btn-secondary"
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exporter CSV
        </button>
      </div>

      {/* Filtres */}
      <TransactionFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Table */}
      <TransactionTable
        transactions={data?.data ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        currentPage={filters.page ?? 1}
        totalPages={totalPages}
        total={data?.total ?? 0}
        onPageChange={handlePageChange}
        onRowClick={(id) => setSelectedTxId(id)}
      />

      {/* Drawer détail */}
      <TransactionDetail
        transactionId={selectedTxId}
        isOpen={!!selectedTxId}
        onClose={() => setSelectedTxId(null)}
      />
    </div>
  )
}
