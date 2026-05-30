'use client'

import { useState } from 'react'
import {
  Plus,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Power,
  Repeat,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  usePaymentLinks,
  useTogglePaymentLink,
  useDeletePaymentLink,
} from '@/lib/hooks/usePaymentLinks'
import { CreatePaymentLinkModal } from '@/components/payment-links/CreatePaymentLinkModal'
import type { PaymentLink } from '@/lib/types'

// =============================================================================
// Page Liens de paiement — /payment-links
// =============================================================================

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
}

export default function PaymentLinksPage() {
  const { data, isLoading } = usePaymentLinks()
  const [showCreate, setShowCreate] = useState(false)

  const links = data?.payment_links ?? []

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Liens de paiement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Créez un lien, partagez-le, encaissez par mobile money — sans code.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Créer un lien
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-40 skeleton rounded" />
                  <div className="h-4 w-56 skeleton rounded" />
                </div>
                <div className="h-9 w-24 skeleton rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Link2 className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">Aucun lien de paiement</p>
            <p className="mt-1 text-sm text-slate-500">
              Créez votre premier lien pour encaisser sans intégration technique.
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
              <Plus className="h-4 w-4" />
              Créer un lien
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {links.map((link) => (
            <PaymentLinkCard key={link.id} link={link} />
          ))}
        </div>
      )}

      <CreatePaymentLinkModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

// =============================================================================
// Carte d'un lien de paiement
// =============================================================================

function PaymentLinkCard({ link }: { link: PaymentLink }) {
  const toggleMutation = useTogglePaymentLink()
  const deleteMutation = useDeletePaymentLink()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(link.url)
    setCopied(true)
    toast.success('Lien copié')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleDelete = () => {
    if (!window.confirm('Supprimer définitivement ce lien de paiement ?')) return
    deleteMutation.mutate(link.id)
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900">
              {formatXAF(link.amount)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                link.is_active
                  ? 'bg-green-50 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {link.is_active ? 'Actif' : 'Inactif'}
            </span>
            {!link.is_reusable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Usage unique
              </span>
            )}
          </div>
          {link.description && (
            <p className="mt-1 text-sm text-slate-600 truncate">{link.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" />
              {link.paid_count} paiement{link.paid_count > 1 ? 's' : ''}
            </span>
          </div>

          {/* URL */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 max-w-full">
            <code className="flex-1 truncate text-xs font-mono text-slate-600">
              {link.url}
            </code>
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Copier le lien"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Ouvrir le lien"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <button
            onClick={() =>
              toggleMutation.mutate({ id: link.id, isActive: !link.is_active })
            }
            disabled={toggleMutation.isPending}
            className="btn-secondary !px-3"
            title={link.is_active ? 'Désactiver' : 'Activer'}
          >
            <Power className="h-4 w-4" />
            {link.is_active ? 'Désactiver' : 'Activer'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
