"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import type { OperatorMetric } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAmountShort } from "@/lib/utils/format"

// =============================================================================
// OperatorPieChart (New ProviderChart Design)
// =============================================================================

interface OperatorPieChartProps {
  data: OperatorMetric[]
  isLoading: boolean
}

export function OperatorPieChart({ data, isLoading }: OperatorPieChartProps) {
  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0)
  
  const chartData = data.map((d) => ({
    name: d.operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money',
    value: d.volume,
    count: d.count,
    color: d.operator === 'AIRTEL' ? "#F97316" : "#3B82F6",
  }))

  if (isLoading) {
    return (
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            Répartition par opérateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 h-[240px]">
            <Skeleton className="h-[160px] w-[160px] rounded-full" />
            <div className="w-full space-y-3 px-4">
               <div className="flex items-center justify-between">
                 <Skeleton className="h-4 w-24" />
                 <Skeleton className="h-4 w-12" />
               </div>
               <div className="flex items-center justify-between">
                 <Skeleton className="h-4 w-24" />
                 <Skeleton className="h-4 w-12" />
               </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-card-foreground">
          Répartition par opérateur
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée disponible
          </div>
        ) : (
          <div className="h-[240px] flex flex-col justify-between">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${formatAmountShort(Number(value))} XAF`, 'Volume']}
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Légende personnalisée pour correspondre au design v0 + extra details */}
            <div className="mt-4 space-y-3 text-sm">
              {chartData.map((d) => {
                const pct = totalVolume > 0 ? ((d.value / totalVolume) * 100).toFixed(1) : '0'
                return (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="font-medium text-foreground">{d.name}</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                       <span className="font-semibold text-foreground">{pct}%</span>
                       <span className="text-muted-foreground text-xs">({d.count} tx)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
