'use client'

import { useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useRevokeApiKey } from '@/lib/hooks/useApiKeys'

// =============================================================================
// RevokeKeyDialog — Confirmation de révocation
// =============================================================================

interface RevokeKeyDialogProps {
  apiKeyId: string
  apiKeyPrefix: string
  isOpen: boolean
  onClose: () => void
}

export function RevokeKeyDialog({
  apiKeyId,
  apiKeyPrefix,
  isOpen,
  onClose,
}: RevokeKeyDialogProps) {
  const revokeMutation = useRevokeApiKey()

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(apiKeyId)
      onClose()
    } catch {
      // Erreur gérée par le hook (toast)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl animate-in">
        <div className="p-6">
          {/* Icône danger */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          <h2 className="text-center text-lg font-semibold text-slate-900">
            Révoquer cette clé ?
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            La clé <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{apiKeyPrefix}••••</code> sera
            immédiatement désactivée. Toute requête utilisant cette clé sera rejetée.
          </p>
          <p className="mt-2 text-center text-sm font-medium text-red-600">
            Cette action est irréversible.
          </p>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              disabled={revokeMutation.isPending}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
            <button
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
              className="btn-danger flex-1"
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Révocation…
                </>
              ) : (
                'Révoquer la clé'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
