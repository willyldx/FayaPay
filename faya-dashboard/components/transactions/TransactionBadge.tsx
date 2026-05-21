'use client'

import { getStatusColor, getStatusLabel } from '@/lib/utils/format'
import type { TransactionStatus } from '@/lib/types'

// =============================================================================
// TransactionBadge — Badge coloré par statut
// =============================================================================

interface TransactionBadgeProps {
  status: TransactionStatus
  /** Afficher avec un point indicateur animé (pour PENDING/PROCESSING) */
  showDot?: boolean
}

export function TransactionBadge({ status, showDot = true }: TransactionBadgeProps) {
  const colors = getStatusColor(status)
  const label = getStatusLabel(status)
  const isAnimated = status === 'PENDING' || status === 'PROCESSING' || status === 'WAITING_SMS'

  return (
    <span className={`badge ${colors}`}>
      {showDot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isAnimated ? 'animate-pulse-dot' : ''
          } ${getDotColor(status)}`}
        />
      )}
      {label}
    </span>
  )
}

/** Couleur du point indicateur */
function getDotColor(status: TransactionStatus): string {
  const map: Record<TransactionStatus, string> = {
    PENDING:     'bg-yellow-500',
    PROCESSING:  'bg-blue-500',
    WAITING_SMS: 'bg-purple-500',
    SUCCESS:     'bg-green-500',
    FAILED:      'bg-red-500',
    TIMEOUT:     'bg-gray-500',
    REFUNDED:    'bg-orange-500',
  }
  return map[status] ?? 'bg-gray-500'
}
