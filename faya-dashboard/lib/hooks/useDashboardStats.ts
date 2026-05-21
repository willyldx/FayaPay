'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@/lib/api/transactions'

// =============================================================================
// Query Keys
// =============================================================================

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (period: string) => [...dashboardKeys.all, 'stats', period] as const,
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Métriques du dashboard overview.
 * Rafraîchissement automatique toutes les 30 secondes (PRD : temps réel).
 */
export function useDashboardStats(period: string = '7d') {
  return useQuery({
    queryKey: dashboardKeys.stats(period),
    queryFn: () => getDashboardStats(period),
    refetchInterval: 30_000, // 30s — conformément au PRD
    staleTime: 15_000,       // Considérer frais pendant 15s
  })
}
