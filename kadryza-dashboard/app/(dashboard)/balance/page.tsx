'use client'

import { useState } from 'react'
import { Wallet, Clock, TrendingUp, Receipt, ArrowDownToLine, Banknote } from 'lucide-react'
import { useBalance, useSettlements, useCancelSettlement } from '@/lib/hooks/useBilling'
import { RequestSettlementModal } from '@/components/billing/RequestSettlementModal'
import type { Settlement, SettlementStatus } from '@/lib/types'

// =============================================================================
// Page Solde — /balance
// =============================================================================

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
}

const STATUS_STYLES: Record<SettlementStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PROCESSING: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<SettlementStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Versé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
}

const METHOD_LABELS: Record<string, string> = {
  AIRTEL: 'Airtel Money',
  MOOV: 'Moov Money',
  BANK: 'Virement bancaire',
}

export default function BalancePage() {
  const { data: balance, isLoading } = useBalance()
  const { data: settlementsData } = useSettlements()
  const [showRequest, setShowRequest] = useState(false)

  const available = balance?.available ?? 0
  const settlements = settlementsData?.settlements ?? []

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Solde</h1>
          <p className="mt-1 text-sm text-slate-500">
            Votre solde, vos frais et vos reversements.
            {balance && (
              <span className="ml-1 text-slate-400">
                Frais Kadryza : {(balance.fee_bps / 100).toFixed(2).replace(/\.00$/, '')} %
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          disabled={available <= 0}
          className="btn-primary disabled:opacity-50"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Demander un retrait
        </button>
      </div>

      {/* Carte solde principal */}
      <div className="card overflow-hidden p-0">
        <div className="bg-gradient-to-br from-kadryza-500 to-kadryza-600 p-6 text-white">
          <p className="text-sm font-medium text-white/80">Solde disponible</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {isLoading ? '—' : formatXAF(available)}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
            <Clock className="h-4 w-4" />
            {formatXAF(balance?.reserved ?? 0)} en cours de reversement
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} label="Volume encaissé" value={formatXAF(balance?.total_volume ?? 0)} sub={`${balance?.payment_count ?? 0} paiement${(balance?.payment_count ?? 0) > 1 ? 's' : ''}`} />
        <StatCard icon={Receipt} label="Frais payés" value={formatXAF(balance?.total_fees ?? 0)} />
        <StatCard icon={Wallet} label="Total reversé" value={formatXAF(balance?.total_settled ?? 0)} />
      </div>

      {/* Historique settlements */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Reversements</h2>
        <p className="mt-1 text-sm text-slate-500">Historique de vos demandes de retrait.</p>

        {settlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Banknote className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">Aucun reversement</p>
            <p className="mt-1 text-sm text-slate-500">
              Demandez un retrait dès que vous avez un solde disponible.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {settlements.map((s) => (
              <SettlementRow key={s.id} settlement={s} />
            ))}
          </div>
        )}
      </div>

      <RequestSettlementModal
        isOpen={showRequest}
        onClose={() => setShowRequest(false)}
        available={available}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function SettlementRow({ settlement: s }: { settlement: Settlement }) {
  const cancelMutation = useCancelSettlement()
  const date = new Date(s.requested_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{formatXAF(s.amount)}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
            {STATUS_LABELS[s.status]}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {METHOD_LABELS[s.method] ?? s.method} · {s.destination} · {date}
        </p>
      </div>
      {s.status === 'PENDING' && (
        <button
          onClick={() => cancelMutation.mutate(s.id)}
          disabled={cancelMutation.isPending}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
      )}
    </div>
  )
}
