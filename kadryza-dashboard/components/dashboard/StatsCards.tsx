'use client'

import {
  TrendingUp,
  ArrowLeftRight,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react'
import type { DashboardStats } from '@/lib/types'
import {
  formatAmount,
  formatAmountCompact,
  formatPercent,
} from '@/lib/utils/format'

// =============================================================================
// StatsCards — 4 cartes métriques
// =============================================================================

interface StatsCardsProps {
  stats?: DashboardStats
  isLoading: boolean
}

interface StatCardConfig {
  label: string
  getValue: (s: DashboardStats) => string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  trend?: string
}

const CARDS: StatCardConfig[] = [
  {
    label: 'Volume total',
    getValue: (s) => formatAmountCompact(s.total_volume),
    icon: TrendingUp,
    iconBg: 'bg-kadryza-100',
    iconColor: 'text-kadryza-600',
  },
  {
    label: 'Transactions',
    getValue: (s) => new Intl.NumberFormat('fr-FR').format(s.total_transactions),
    icon: ArrowLeftRight,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    label: 'Taux de succès',
    getValue: (s) => formatPercent(s.success_rate),
    icon: CheckCircle2,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    label: "Aujourd'hui",
    getValue: (s) => {
      const today = new Date().toISOString().slice(0, 10)
      const todayData = s.transactions_by_day.find((d) => d.date === today)
      return todayData
        ? new Intl.NumberFormat('fr-FR').format(todayData.count)
        : '0'
    },
    icon: CalendarClock,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
]

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => (
        <div key={card.label} className="card-hover p-5">
          {isLoading ? (
            <StatCardSkeleton />
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                  {stats ? card.getValue(stats) : '—'}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function StatCardSkeleton() {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-3">
        <div className="h-4 w-24 skeleton rounded" />
        <div className="h-7 w-32 skeleton rounded" />
      </div>
      <div className="h-10 w-10 skeleton rounded-lg" />
    </div>
  )
}
