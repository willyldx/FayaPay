'use client'

import { AreaChart } from '@tremor/react'
import type { DayMetric } from '@/lib/types'
import { formatAmountShort } from '@/lib/utils/format'

// =============================================================================
// TransactionChart — Volume XAF sur 7 jours (Tremor AreaChart)
// =============================================================================

interface TransactionChartProps {
  data: DayMetric[]
  isLoading: boolean
}

/**
 * Formater la date "2024-01-15" → "15 jan."
 */
function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export function TransactionChart({ data, isLoading }: TransactionChartProps) {
  // Transformer les données pour Tremor
  const chartData = data.map((d) => ({
    date: formatChartDate(d.date),
    'Volume (XAF)': d.volume,
    Transactions: d.count,
  }))

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Volume des transactions
          </h2>
          <p className="text-sm text-slate-500">
            Évolution sur les 7 derniers jours
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-faya-500" />
            Volume
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Nb transactions
          </span>
        </div>
      </div>

      {isLoading ? (
        <ChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
          Aucune donnée disponible
        </div>
      ) : (
        <AreaChart
          className="h-[280px]"
          data={chartData}
          index="date"
          categories={['Volume (XAF)', 'Transactions']}
          colors={['orange', 'blue']}
          valueFormatter={(value) => formatAmountShort(value)}
          yAxisWidth={80}
          showAnimation
          showLegend={false}
          showGridLines={true}
          curveType="monotone"
        />
      )}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function ChartSkeleton() {
  return (
    <div className="h-[280px] flex flex-col justify-end gap-1 px-4">
      {/* Fake bars to simulate chart loading */}
      <div className="flex items-end gap-2 h-full">
        {[65, 45, 80, 55, 90, 70, 50].map((h, i) => (
          <div
            key={i}
            className="flex-1 skeleton rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      {/* Fake x-axis labels */}
      <div className="flex justify-between mt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 w-10 skeleton rounded" />
        ))}
      </div>
    </div>
  )
}
