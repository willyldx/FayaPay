'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { resendVerification } from '@/lib/api/merchants'

// =============================================================================
// Page Vérification Email — Suspense boundary pour useSearchParams
// =============================================================================

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="h-[350px] w-full animate-pulse rounded-xl border bg-card shadow-sm" />}>
      <VerifyEmailContent />
    </Suspense>
  )
}

// =============================================================================
// Contenu — "Vérifiez votre boîte mail"
// =============================================================================

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [isSending, setIsSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Décompte du cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = useCallback(async () => {
    if (isSending || cooldown > 0 || !email) return
    setIsSending(true)
    try {
      await resendVerification(email)
      toast.success('Email de vérification renvoyé !')
      setCooldown(60)
    } catch {
      toast.error("Impossible de renvoyer l'email. Réessayez plus tard.")
    } finally {
      setIsSending(false)
    }
  }, [email, isSending, cooldown])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 flex flex-col items-center text-center">
          {/* Icône */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-5">
            <Mail className="h-8 w-8 text-primary" />
          </div>

          {/* Titre */}
          <h1 className="text-xl font-semibold leading-none tracking-tight">
            Vérifiez votre boîte mail
          </h1>

          {/* Sous-titre */}
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            Un email de vérification a été envoyé
            {email && (
              <>
                {' '}à{' '}
                <span className="font-medium text-foreground">{email}</span>
              </>
            )}
            . Cliquez sur le lien pour activer votre compte.
          </p>

          {/* Bouton Renvoyer */}
          <button
            onClick={handleResend}
            disabled={isSending || cooldown > 0 || !email}
            className="group relative inline-flex h-10 w-full mt-6 items-center justify-center overflow-hidden rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:ring-2 hover:ring-primary/20 hover:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
              <div className="relative h-full w-12 bg-white/20" />
            </div>
            <span className="relative flex items-center gap-2">
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours…
                </>
              ) : cooldown > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Renvoyer dans {cooldown}s
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Renvoyer l&apos;email
                </>
              )}
            </span>
          </button>

          {/* Info */}
          <p className="mt-4 text-xs text-muted-foreground">
            Vérifiez aussi vos dossiers spam et promotions.
          </p>
        </div>
      </div>

      {/* Lien retour */}
      <div className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-primary">
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
