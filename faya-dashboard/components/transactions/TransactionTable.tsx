'use client'

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import type { Transaction } from '@/lib/types'
import { formatAmount, formatDate, formatPhone } from '@/lib/utils/format'
import { TransactionBadge } from './TransactionBadge'

// =============================================================================
// TransactionTable — Table paginée 20/page
// =============================================================================

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  isFetching: boolean
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onRowClick: (id: string) => void
}

export function TransactionTable({
  transactions,
  isLoading,
  isFetching,
  currentPage,
  totalPages,
  total,
  onPageChange,
  onRowClick,
}: TransactionTableProps) {
  if (isLoading) return <TableSkeleton />

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-6 w-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900">
            Aucune transaction trouvée
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Modifiez vos filtres ou attendez de nouvelles transactions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {/* Indicateur de chargement discret */}
      {isFetching && !isLoading && (
        <div className="h-0.5 w-full overflow-hidden bg-slate-100">
          <div className="h-full w-1/3 animate-pulse bg-faya-400 rounded-full" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Référence
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Montant
              </th>
              <th className="hidden px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                Opérateur
              </th>
              <th className="hidden px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                Téléphone
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Statut
              </th>
              <th className="hidden px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                onClick={() => onRowClick(tx.id)}
                className="cursor-pointer transition-colors hover:bg-slate-50/70"
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm font-medium text-slate-900 font-mono">
                    {tx.reference}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                    {formatAmount(tx.amount)}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-6 py-4 sm:table-cell">
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      tx.operator === 'AIRTEL'
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        tx.operator === 'AIRTEL'
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    {tx.operator}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-6 py-4 md:table-cell">
                  <span className="text-sm text-slate-600 font-mono">
                    {formatPhone(tx.phone_number)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <TransactionBadge status={tx.status} />
                </td>
                <td className="hidden whitespace-nowrap px-6 py-4 text-right lg:table-cell">
                  <span className="text-sm text-slate-500">
                    {formatDate(tx.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Page{' '}
            <span className="font-medium text-slate-900">{currentPage}</span>
            {' '}sur{' '}
            <span className="font-medium text-slate-900">{totalPages}</span>
            {' '}—{' '}
            <span className="font-medium text-slate-900">
              {new Intl.NumberFormat('fr-FR').format(total)}
            </span>
            {' '}résultats
          </p>

          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              aria-label="Première page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationButton>
            <PaginationButton
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationButton>

            {/* Numéros de page */}
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === '...' ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-sm text-slate-400"
                >
                  …
                </span>
              ) : (
                <PaginationButton
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  active={currentPage === p}
                >
                  {p}
                </PaginationButton>
              )
            )}

            <PaginationButton
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationButton>
            <PaginationButton
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              aria-label="Dernière page"
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Pagination helpers
// =============================================================================

interface PaginationButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  'aria-label'?: string
}

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
  ...props
}: PaginationButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex h-8 min-w-[32px] items-center justify-center rounded-md px-2
        text-sm font-medium transition-colors
        ${
          active
            ? 'bg-faya-500 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent'
        }
        disabled:cursor-not-allowed
      `}
      {...props}
    >
      {children}
    </button>
  )
}

/** Génère les numéros de page à afficher avec ellipses. */
function getPageNumbers(
  current: number,
  total: number
): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}

// =============================================================================
// Skeleton
// =============================================================================

function TableSkeleton() {
  return (
    <div className="card">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-3.5">
        <div className="flex gap-12">
          {['w-20', 'w-24', 'w-16', 'w-28', 'w-16', 'w-24'].map((w, i) => (
            <div key={i} className={`h-3 ${w} skeleton rounded`} />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-12 px-6 py-4">
            <div className="h-4 w-28 skeleton rounded" />
            <div className="h-4 w-24 skeleton rounded" />
            <div className="hidden sm:block h-4 w-16 skeleton rounded" />
            <div className="hidden md:block h-4 w-28 skeleton rounded" />
            <div className="h-5 w-16 skeleton rounded-full" />
            <div className="hidden lg:block h-4 w-32 skeleton rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
