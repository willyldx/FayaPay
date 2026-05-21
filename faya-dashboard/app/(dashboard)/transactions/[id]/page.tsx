'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  Phone,
  CreditCard,
  Hash,
  Globe,
  AlertTriangle,
  Send,
} from 'lucide-react'
import { useState } from 'react'
import { useTransaction } from '@/lib/hooks/useTransactions'
import { TransactionBadge } from '@/components/transactions/TransactionBadge'
import {
  formatAmount,
  formatDate,
  formatPhone,
  formatDateRelative,
} from '@/lib/utils/format'

// =============================================================================
// Page Détail Transaction — /transactions/:id
// =============================================================================

export default function TransactionDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: tx, isLoading, error } = useTransaction(id)

  if (isLoading) return <DetailSkeleton />

  if (error || !tx) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <AlertTriangle className="h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-500">Transaction introuvable</p>
        <Link href="/transactions" className="btn-secondary text-sm">
          <ArrowLeft className="h-4 w-4" />
          Retour aux transactions
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/transactions"
          className="flex h-9 w-9 items-center justify-center rounded-lg
                     border border-slate-200 text-slate-500
                     transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 font-mono">
              {tx.reference}
            </h1>
            <TransactionBadge status={tx.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatDateRelative(tx.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne gauche — Détails principaux */}
        <div className="lg:col-span-2 space-y-6">
          {/* Montant */}
          <div className="card p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">Montant</p>
            <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {formatAmount(tx.amount)}
            </p>
          </div>

          {/* Informations */}
          <div className="card divide-y divide-slate-100">
            <DetailRow
              icon={Hash}
              label="Référence"
              value={tx.reference}
              mono
              copyable
            />
            <DetailRow
              icon={Hash}
              label="Référence interne"
              value={tx.internal_ref}
              mono
              copyable
            />
            <DetailRow
              icon={CreditCard}
              label="Opérateur"
              value={tx.operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money'}
            />
            <DetailRow
              icon={Phone}
              label="Téléphone"
              value={formatPhone(tx.phone_number)}
              mono
            />
            {tx.description && (
              <DetailRow
                icon={Globe}
                label="Description"
                value={tx.description}
              />
            )}
            <DetailRow
              icon={Send}
              label="Webhook envoyé"
              value={tx.webhook_sent ? 'Oui ✓' : 'Non'}
            />
            {tx.failure_reason && (
              <DetailRow
                icon={AlertTriangle}
                label="Raison de l'échec"
                value={tx.failure_reason}
                valueClassName="text-red-600"
              />
            )}
          </div>
        </div>

        {/* Colonne droite — Timeline */}
        <div className="space-y-6">
          {/* Timeline des événements */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Chronologie
            </h2>
            <div className="space-y-0">
              <TimelineItem
                label="Création"
                date={tx.created_at}
                status="done"
              />
              <TimelineItem
                label="Initiation"
                date={tx.initiated_at}
                status="done"
              />
              {tx.confirmed_at ? (
                <TimelineItem
                  label={tx.status === 'SUCCESS' ? 'Confirmation' : 'Terminée'}
                  date={tx.confirmed_at}
                  status={tx.status === 'SUCCESS' ? 'success' : 'error'}
                  isLast
                />
              ) : (
                <TimelineItem
                  label="Expiration prévue"
                  date={tx.expires_at}
                  status={tx.status === 'TIMEOUT' ? 'error' : 'pending'}
                  isLast
                />
              )}
            </div>
          </div>

          {/* Dates détaillées */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Dates
            </h2>
            <div className="space-y-3 text-sm">
              <DateItem label="Créée le" date={tx.created_at} />
              <DateItem label="Initiée le" date={tx.initiated_at} />
              {tx.confirmed_at && (
                <DateItem label="Confirmée le" date={tx.confirmed_at} />
              )}
              <DateItem label="Expire le" date={tx.expires_at} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Sous-composants
// =============================================================================

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
  valueClassName?: string
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  copyable,
  valueClassName,
}: DetailRowProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium text-slate-900 ${
            mono ? 'font-mono' : ''
          } ${valueClassName ?? ''}`}
        >
          {value}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded
                       text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Copier"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

interface TimelineItemProps {
  label: string
  date: string
  status: 'done' | 'success' | 'error' | 'pending'
  isLast?: boolean
}

function TimelineItem({ label, date, status, isLast }: TimelineItemProps) {
  const dotColors = {
    done: 'bg-slate-400',
    success: 'bg-green-500',
    error: 'bg-red-500',
    pending: 'bg-yellow-400 animate-pulse-dot',
  }

  return (
    <div className="flex gap-3">
      {/* Ligne + point */}
      <div className="flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${dotColors[status]}`} />
        {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      {/* Contenu */}
      <div className={`pb-5 ${isLast ? 'pb-0' : ''}`}>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{formatDate(date)}</p>
      </div>
    </div>
  )
}

function DateItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-mono text-xs tabular-nums">
        {formatDate(date)}
      </span>
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 skeleton rounded-lg" />
        <div className="space-y-2">
          <div className="h-6 w-48 skeleton rounded" />
          <div className="h-4 w-24 skeleton rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="h-4 w-16 skeleton rounded mb-2" />
            <div className="h-9 w-48 skeleton rounded" />
          </div>
          <div className="card p-6 space-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 skeleton rounded" />
                  <div className="h-4 w-24 skeleton rounded" />
                </div>
                <div className="h-4 w-32 skeleton rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <div className="h-4 w-24 skeleton rounded mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-2.5 w-2.5 skeleton rounded-full mt-1" />
                  <div className="space-y-1">
                    <div className="h-4 w-20 skeleton rounded" />
                    <div className="h-3 w-32 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
