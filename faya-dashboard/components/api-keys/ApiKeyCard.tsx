'use client'

import { useState } from 'react'
import { Key, Copy, Check, Trash2 } from 'lucide-react'
import type { ApiKey } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'
import { RevokeKeyDialog } from './RevokeKeyDialog'

// =============================================================================
// ApiKeyCard — Affichage d'une clé API (préfixe tronqué)
// =============================================================================

interface ApiKeyCardProps {
  apiKey: ApiKey
}

export function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const [showRevoke, setShowRevoke] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyPrefix = () => {
    navigator.clipboard.writeText(apiKey.prefix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="card-hover p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Infos clé */}
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-faya-100">
              <Key className="h-5 w-5 text-faya-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-semibold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">
                  {apiKey.prefix}••••••••
                </code>
                <button
                  onClick={handleCopyPrefix}
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Copier le préfixe"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Créée le {formatDate(apiKey.created_at)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowRevoke(true)}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2
                       text-sm font-medium text-red-600
                       transition-colors hover:bg-red-50
                       sm:self-center"
          >
            <Trash2 className="h-4 w-4" />
            Révoquer
          </button>
        </div>
      </div>

      {/* Dialog confirmation révocation */}
      <RevokeKeyDialog
        apiKeyId={apiKey.id}
        apiKeyPrefix={apiKey.prefix}
        isOpen={showRevoke}
        onClose={() => setShowRevoke(false)}
      />
    </>
  )
}
