'use client'

import { useState } from 'react'
import { Plus, Webhook } from 'lucide-react'
import { useWebhooks } from '@/lib/hooks/useWebhooks'
import { WebhookCard } from '@/components/webhooks/WebhookCard'
import { CreateWebhookModal } from '@/components/webhooks/CreateWebhookModal'

// =============================================================================
// Page Webhooks — /webhooks
// =============================================================================

export default function WebhooksPage() {
  const { data: webhooks, isLoading } = useWebhooks()
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Webhooks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Recevez des notifications en temps réel sur vos transactions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Ajouter un endpoint
        </button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex gap-3">
          <Webhook className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Comment ça fonctionne</p>
            <p className="mt-1 text-blue-700">
              FayaPay enverra un POST HTTPS à chaque endpoint actif lorsqu&apos;une transaction
              change de statut. Vérifiez la signature avec votre secret webhook.
            </p>
          </div>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-64 skeleton rounded" />
                  <div className="h-4 w-32 skeleton rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-20 skeleton rounded-lg" />
                  <div className="h-9 w-20 skeleton rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Webhook className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Aucun endpoint webhook
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Configurez un endpoint pour recevoir les notifications de paiement.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mt-4"
            >
              <Plus className="h-4 w-4" />
              Ajouter un endpoint
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((wh) => (
            <WebhookCard key={wh.id} webhook={wh} />
          ))}
        </div>
      )}

      {/* Modal création */}
      <CreateWebhookModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
