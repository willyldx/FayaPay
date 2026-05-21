'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Transaction } from '@/lib/types'
import { formatAmount, formatDateRelative, formatPhone } from '@/lib/utils/format'
import { TransactionBadge } from '@/components/transactions/TransactionBadge'

// =============================================================================
// RecentTransactions — Tableau 10 dernières transactions
// =============================================================================

interface RecentTransactionsProps {
  transactions: Transaction[]
  isLoading: boolean
}

export function RecentTransactions({
  transactions,
  isLoading,
}: RecentTransactionsProps) {
  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Transactions récentes
          </h2>
          <p className="text-sm text-slate-500">
            Les 10 dernières opérations
          </p>
        </div>
        <Link
          href="/transactions"
          className="flex items-center gap-1.5 text-sm font-medium text-faya-500 hover:text-faya-600 transition-colors"
        >
          Tout voir
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : transactions.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
          Aucune transaction pour le moment
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Référence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Montant
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 sm:table-cell">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Statut
                </th>
                <th className="hidden px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 md:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="transition-colors hover:bg-slate-50/50"
                >
                  <td className="whitespace-nowrap px-6 py-3.5">
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="text-sm font-medium text-slate-900 font-mono hover:text-faya-500 transition-colors"
                    >
                      {tx.reference}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tx.operator}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5">
                    <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                      {formatAmount(tx.amount)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-3.5 sm:table-cell">
                    <span className="text-sm text-slate-600 font-mono">
                      {formatPhone(tx.phone_number)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5">
                    <TransactionBadge status={tx.status} />
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-3.5 text-right md:table-cell">
                    <span className="text-sm text-slate-500">
                      {formatDateRelative(tx.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function TableSkeleton() {
  return (
    <div className="px-6 py-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-28 skeleton rounded" />
          <div className="h-4 w-24 skeleton rounded" />
          <div className="hidden sm:block h-4 w-28 skeleton rounded" />
          <div className="h-5 w-16 skeleton rounded-full" />
          <div className="hidden md:block h-4 w-20 skeleton rounded ml-auto" />
        </div>
      ))}
    </div>
  )
}
