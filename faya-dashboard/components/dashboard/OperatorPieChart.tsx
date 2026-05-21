'use client'

import { DonutChart } from '@tremor/react'
import type { OperatorMetric } from '@/lib/types'
import { formatAmountShort } from '@/lib/utils/format'

// =============================================================================
// OperatorPieChart — Répartition Airtel vs Moov (Tremor DonutChart)
// =============================================================================

interface OperatorPieChartProps {
  data: OperatorMetric[]
  isLoading: boolean
}

/** Couleurs par opérateur pour Tremor */
const OPERATOR_TREMOR_COLORS: Record<string, string> = {
  AIRTEL: 'rose',
  MOOV: 'blue',
}

export function OperatorPieChart({ data, isLoading }: OperatorPieChartProps) {
  // Transformer les données pour Tremor
  const chartData = data.map((d) => ({
    name: d.operator,
    value: d.volume,
    count: d.count,
  }))

  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0)
  const colors = data.map((d) => OPERATOR_TREMOR_COLORS[d.operator] ?? 'gray')

  return (
    <div className="card p-6 h-full">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900">
          Par opérateur
        </h2>
        <p className="text-sm text-slate-500">
          Répartition du volume
        </p>
      </div>

      {isLoading ? (
        <PieChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
          Aucune donnée disponible
        </div>
      ) : (
        <>
          <DonutChart
            className="h-[200px]"
            data={chartData}
            category="value"
            index="name"
            colors={colors}
            valueFormatter={(value) => `${formatAmountShort(value)} XAF`}
            showAnimation
            showTooltip
            variant="donut"
          />

          {/* Légende détaillée */}
          <div className="mt-6 space-y-3">
            {data.map((d) => {
              const pct =
                totalVolume > 0
                  ? ((d.volume / totalVolume) * 100).toFixed(1)
                  : '0'

              return (
                <div
                  key={d.operator}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        d.operator === 'AIRTEL' ? 'bg-rose-500' : 'bg-blue-500'
                      }`}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {d.operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                      {pct}%
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      ({new Intl.NumberFormat('fr-FR').format(d.count)} tx)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function PieChartSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Fake donut */}
      <div className="h-[200px] w-[200px] rounded-full skeleton relative">
        <div className="absolute inset-[40px] rounded-full bg-white" />
      </div>
      {/* Fake legend */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 skeleton rounded-full" />
            <div className="h-4 w-20 skeleton rounded" />
          </div>
          <div className="h-4 w-12 skeleton rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 skeleton rounded-full" />
            <div className="h-4 w-20 skeleton rounded" />
          </div>
          <div className="h-4 w-12 skeleton rounded" />
        </div>
      </div>
    </div>
  )
}
