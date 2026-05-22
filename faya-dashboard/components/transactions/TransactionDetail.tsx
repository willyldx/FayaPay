'use client'

import { useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  Hash,
  CreditCard,
  Phone,
  Globe,
  Send,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import { useTransaction } from '@/lib/hooks/useTransactions'
import { TransactionBadge } from './TransactionBadge'
import {
  formatAmount,
  formatDate,
  formatPhone,
  getStatusLabel,
} from '@/lib/utils/format'

// =============================================================================
// TransactionDetail — Drawer latéral
// =============================================================================

interface TransactionDetailProps {
  transactionId: string | null
  isOpen: boolean
  onClose: () => void
}

export function TransactionDetail({
  transactionId,
  isOpen,
  onClose,
}: TransactionDetailProps) {
  // [M-2 FIX] Passer isOpen pour ne pas fetch quand le drawer est fermé
  const { data: tx, isLoading } = useTransaction(transactionId ?? '', isOpen)

  // --- Fermer avec Escape ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-detail-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Détail transaction
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg
                       text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <DrawerSkeleton />
          ) : !tx ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <AlertTriangle className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                Transaction introuvable
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Montant + Statut */}
              <div className="px-6 py-6 text-center bg-slate-50/50">
                <TransactionBadge status={tx.status} />
                <p className="mt-3 text-3xl font-bold text-slate-900 font-mono tabular-nums">
                  {formatAmount(tx.amount)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {tx.operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money'}
                </p>
              </div>

              {/* Informations détaillées */}
              <div className="px-6 py-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Informations
                </h3>
                <DrawerRow icon={Hash} label="Référence" value={tx.reference} mono copyable />
                <DrawerRow icon={Hash} label="Réf. interne" value={tx.internal_ref} mono copyable />
                <DrawerRow icon={Phone} label="Téléphone" value={formatPhone(tx.phone_number)} mono />
                <DrawerRow icon={CreditCard} label="Opérateur" value={tx.operator} />
                {tx.description && (
                  <DrawerRow icon={Globe} label="Description" value={tx.description} />
                )}
                <DrawerRow
                  icon={Send}
                  label="Webhook"
                  value={tx.webhook_sent ? 'Envoyé ✓' : 'Non envoyé'}
                />
              </div>

              {/* Échec */}
              {tx.failure_reason && (
                <div className="px-6 py-5">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          Raison de l&apos;échec
                        </p>
                        <p className="mt-1 text-sm text-red-700">
                          {tx.failure_reason}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="px-6 py-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Chronologie
                </h3>
                <div className="space-y-0">
                  <DrawerTimeline
                    label="Créée"
                    date={tx.created_at}
                    status="done"
                  />
                  <DrawerTimeline
                    label="Initiée"
                    date={tx.initiated_at}
                    status="done"
                  />
                  {tx.confirmed_at ? (
                    <DrawerTimeline
                      label={tx.status === 'SUCCESS' ? 'Confirmée' : getStatusLabel(tx.status)}
                      date={tx.confirmed_at}
                      status={tx.status === 'SUCCESS' ? 'success' : 'error'}
                      isLast
                    />
                  ) : (
                    <DrawerTimeline
                      label={tx.status === 'TIMEOUT' ? 'Expirée' : 'Expiration prévue'}
                      date={tx.expires_at}
                      status={tx.status === 'TIMEOUT' ? 'error' : 'pending'}
                      isLast
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Sous-composants
// =============================================================================

interface DrawerRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
}

function DrawerRow({ icon: Icon, label, value, mono, copyable }: DrawerRowProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-sm text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Copier"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

interface DrawerTimelineProps {
  label: string
  date: string
  status: 'done' | 'success' | 'error' | 'pending'
  isLast?: boolean
}

function DrawerTimeline({ label, date, status, isLast }: DrawerTimelineProps) {
  const dotColors = {
    done: 'bg-slate-400',
    success: 'bg-green-500',
    error: 'bg-red-500',
    pending: 'bg-yellow-400 animate-pulse-dot',
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColors[status]}`} />
        {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      <div className={isLast ? '' : 'pb-4'}>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 font-mono tabular-nums">
          {formatDate(date)}
        </p>
      </div>
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function DrawerSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {/* Montant + statut */}
      <div className="px-6 py-6 flex flex-col items-center gap-3">
        <div className="h-5 w-16 skeleton rounded-full" />
        <div className="h-9 w-40 skeleton rounded" />
        <div className="h-4 w-20 skeleton rounded" />
      </div>
      {/* Infos */}
      <div className="px-6 py-5 space-y-4">
        <div className="h-3 w-24 skeleton rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 skeleton rounded" />
              <div className="h-4 w-20 skeleton rounded" />
            </div>
            <div className="h-4 w-28 skeleton rounded" />
          </div>
        ))}
      </div>
      {/* Timeline */}
      <div className="px-6 py-5 space-y-4">
        <div className="h-3 w-24 skeleton rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-2.5 w-2.5 skeleton rounded-full mt-1" />
            <div className="space-y-1 pb-3">
              <div className="h-4 w-16 skeleton rounded" />
              <div className="h-3 w-32 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
