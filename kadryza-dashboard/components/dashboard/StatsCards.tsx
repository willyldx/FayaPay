"use client"

import {
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardStats } from "@/lib/types"
import {
  formatAmount,
  formatAmountCompact,
  formatPercent,
} from "@/lib/utils/format"
import { Skeleton } from "@/components/ui/skeleton"

// =============================================================================
// MetricCard
// =============================================================================

interface MetricCardProps {
  title: string
  value: string
  change?: {
    value: string
    trend: "up" | "down" | "neutral"
  }
  subtitle?: string
  icon?: React.ReactNode
  isLoading?: boolean
}

function MetricCard({ title, value, change, subtitle, icon, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-card-foreground">{value}</div>
        {change && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {change.trend === "up" && (
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            )}
            {change.trend === "down" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            {change.trend === "neutral" && (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
              "font-medium",
              change.trend === "up" && "text-emerald-600",
              change.trend === "down" && "text-red-500",
              change.trend === "neutral" && "text-muted-foreground"
            )}>
              {change.value}
            </span>
            <span className="text-muted-foreground">vs semaine dernière</span>
          </div>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// StatsCards
// =============================================================================

interface StatsCardsProps {
  stats?: DashboardStats
  isLoading: boolean
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  // Calcul pour "Aujourd'hui"
  const getTodayData = () => {
    if (!stats) return { value: '0 XAF', subtitle: '0 transaction' }
    const today = new Date().toISOString().slice(0, 10)
    const todayData = stats.transactions_by_day.find((d) => d.date === today)
    
    // Si on avait le volume du jour, on le formaterait. Par défaut on affiche le nb de transactions aujourd'hui pour l'instant.
    return {
      value: todayData ? new Intl.NumberFormat('fr-FR').format(todayData.count) : '0',
      subtitle: "transactions aujourd'hui"
    }
  }

  const todayInfo = getTodayData()

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Volume Total"
        value={stats ? formatAmountCompact(stats.total_volume) : '—'}
        icon={<Wallet className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Transactions"
        value={stats ? new Intl.NumberFormat('fr-FR').format(stats.total_transactions) : '—'}
        icon={<ArrowRightLeft className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Taux de Succès"
        value={stats ? formatPercent(stats.success_rate) : '—'}
        icon={<CheckCircle2 className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Aujourd'hui"
        value={todayInfo.value}
        subtitle={todayInfo.subtitle}
        icon={<CalendarDays className="h-5 w-5" />}
        isLoading={isLoading}
      />
    </div>
  )
}
