"use client"

import { useDashboardStats } from "@/lib/hooks/useDashboardStats"
import { useTransactions } from "@/lib/hooks/useTransactions"
import { StatsCards } from "@/components/dashboard/StatsCards"
import { TransactionChart } from "@/components/dashboard/TransactionChart"
import { OperatorPieChart } from "@/components/dashboard/OperatorPieChart"
import { RecentTransactions } from "@/components/dashboard/RecentTransactions"
import { GatewayStatus } from "@/components/dashboard/GatewayStatus"

// =============================================================================
// Dashboard Overview — Page principale
// =============================================================================

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats('7d')

  const {
    data: recentTx,
    isLoading: txLoading,
  } = useTransactions({ per_page: 10, page: 1 })

  return (
    <div className="animate-in space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Vue d&apos;ensemble
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur votre tableau de bord Kadryza
        </p>
      </div>

      {/* Erreur stats */}
      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les métriques. Vérifiez votre connexion.
        </div>
      )}

      {/* Metric Cards (StatsCards contains the grid of MetricCards) */}
      <StatsCards stats={stats} isLoading={statsLoading} />

      {/* Charts Row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransactionChart
            data={stats?.transactions_by_day ?? []}
            isLoading={statsLoading}
          />
        </div>
        <div>
          <OperatorPieChart
            data={stats?.by_operator ?? []}
            isLoading={statsLoading}
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions
            transactions={recentTx?.data ?? []}
            isLoading={txLoading}
          />
        </div>
        <div>
          <GatewayStatus />
        </div>
      </div>
    </div>
  )
}
