'use client'

import { useDashboardStats } from '@/lib/hooks/useDashboardStats'
import { useTransactions } from '@/lib/hooks/useTransactions'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TransactionChart } from '@/components/dashboard/TransactionChart'
import { OperatorPieChart } from '@/components/dashboard/OperatorPieChart'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { GatewayStatus } from '@/components/dashboard/GatewayStatus'

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
    <div className="space-y-6 animate-in">
      {/* Titre */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Vue d&apos;ensemble
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi en temps réel de votre activité FayaPay
        </p>
      </div>

      {/* Erreur stats */}
      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les métriques. Vérifiez votre connexion.
        </div>
      )}

      {/* Cartes métriques */}
      <StatsCards stats={stats} isLoading={statsLoading} />

      {/* Graphiques : volume + répartition opérateurs */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
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

      {/* Transactions récentes + Statut gateway */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
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
