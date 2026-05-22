'use client'

import { useState } from 'react'
import { Plus, Key } from 'lucide-react'
import { useApiKeys } from '@/lib/hooks/useApiKeys'
import { ApiKeyCard } from '@/components/api-keys/ApiKeyCard'
import { CreateApiKeyModal } from '@/components/api-keys/CreateApiKeyModal'

// =============================================================================
// Page Clés API — /api-keys
// =============================================================================

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys()
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Clés API
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez vos clés d&apos;accès à l&apos;API FayaPay
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Créer une clé
        </button>
      </div>

      {/* Avertissement */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex gap-3">
          <Key className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Sécurité des clés API</p>
            <p className="mt-1 text-amber-700">
              Les clés API donnent un accès complet à votre compte. Ne les partagez jamais
              et ne les exposez pas dans du code client. Utilisez des variables d&apos;environnement.
            </p>
          </div>
        </div>
      </div>

      {/* Liste des clés */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-48 skeleton rounded" />
                  <div className="h-4 w-32 skeleton rounded" />
                </div>
                <div className="h-9 w-24 skeleton rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : !keys || keys.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Key className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Aucune clé API
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Créez votre première clé pour commencer à intégrer FayaPay.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mt-4"
            >
              <Plus className="h-4 w-4" />
              Créer une clé
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {keys.map((key) => (
            <ApiKeyCard key={key.id} apiKey={key} />
          ))}
        </div>
      )}

      {/* Modal création */}
      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
