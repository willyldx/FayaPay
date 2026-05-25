'use client'

import { useState } from 'react'
import { AlertTriangle, X, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores/authStore'
import { resendVerification } from '@/lib/api/merchants'

// =============================================================================
// EmailVerificationBanner — Bandeau orange si email non vérifié
// =============================================================================

export function EmailVerificationBanner() {
  const merchant = useAuthStore((s) => s.merchant)
  const [dismissed, setDismissed] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Ne pas afficher si le merchant est vérifié ou si le banner est fermé
  if (!merchant || merchant.email_verified || dismissed) return null

  const handleResend = async () => {
    if (isSending) return
    setIsSending(true)
    try {
      await resendVerification(merchant.email)
      toast.success('Email de vérification renvoyé !')
    } catch {
      toast.error("Impossible de renvoyer l'email. Réessayez plus tard.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 truncate">
              <span className="font-medium">Vérifiez votre email</span>
              {' '}pour accéder à toutes les fonctionnalités.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleResend}
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              Renvoyer l&apos;email
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800"
              aria-label="Fermer le bandeau"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
