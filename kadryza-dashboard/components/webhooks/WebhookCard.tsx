'use client'

import { useState, useEffect } from 'react'
import { Globe, Trash2, ToggleLeft, ToggleRight, Loader2, AlertTriangle } from 'lucide-react'
import type { WebhookEndpoint } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'
import { useDeleteWebhook, useToggleWebhook } from '@/lib/hooks/useWebhooks'
import { TestWebhookButton } from './TestWebhookButton'

// =============================================================================
// WebhookCard — Affichage d'un endpoint webhook
// =============================================================================

interface WebhookCardProps {
  webhook: WebhookEndpoint
}

export function WebhookCard({ webhook }: WebhookCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteMutation = useDeleteWebhook()
  const toggleMutation = useToggleWebhook()

  const handleToggle = () => {
    toggleMutation.mutate({
      id: webhook.id,
      isActive: !webhook.is_active,
    })
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(webhook.id)
    } catch {
      // toast géré par le hook
    }
  }

  return (
    <div className="card-hover p-6">
      <div className="flex flex-col gap-4">
        {/* Ligne principale */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* URL + statut */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                webhook.is_active ? 'bg-green-100' : 'bg-slate-100'
              }`}
            >
              <Globe
                className={`h-5 w-5 ${
                  webhook.is_active ? 'text-green-600' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm font-medium text-slate-900 font-mono truncate block max-w-[400px]">
                  {webhook.url}
                </code>
                <span
                  className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    webhook.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {webhook.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Créé le {formatDate(webhook.created_at)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Test */}
            <TestWebhookButton webhookId={webhook.id} disabled={!webhook.is_active} />

            {/* Toggle actif/inactif */}
            <button
              onClick={handleToggle}
              disabled={toggleMutation.isPending}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                webhook.is_active
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
              aria-label={webhook.is_active ? 'Désactiver' : 'Activer'}
            >
              {toggleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : webhook.is_active ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {webhook.is_active ? 'Désactiver' : 'Activer'}
              </span>
            </button>

            {/* Supprimer */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation suppression inline */}
      {showDeleteConfirm && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Supprimer cet endpoint ?
              </p>
              <p className="mt-1 text-sm text-red-700">
                Vous ne recevrez plus de notifications à cette URL. Cette action est irréversible.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteMutation.isPending}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="btn-danger text-sm px-3 py-1.5"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Suppression…
                    </>
                  ) : (
                    'Confirmer la suppression'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
