'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { verifyEmail } from '@/lib/api/merchants'

// =============================================================================
// Page Vérification Token — Appelée depuis le lien email
// =============================================================================

type VerifyState = 'loading' | 'success' | 'error'

export default function VerifyTokenPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<VerifyState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!params.token) {
      setState('error')
      setErrorMessage('Token de vérification manquant.')
      return
    }

    let cancelled = false

    async function verify() {
      try {
        await verifyEmail(params.token)
        if (cancelled) return
        setState('success')
        toast.success('Email vérifié ! Vous pouvez vous connecter.')
        // Auto-redirect après 2 secondes
        setTimeout(() => {
          if (!cancelled) router.push('/login')
        }, 2000)
      } catch (error) {
        if (cancelled) return
        setState('error')
        if (error instanceof Error) {
          setErrorMessage(error.message)
        } else {
          setErrorMessage('Le lien de vérification est invalide ou a expiré.')
        }
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [params.token, router])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6 flex flex-col items-center text-center">
          {state === 'loading' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-5">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h1 className="text-xl font-semibold leading-none tracking-tight">
                Vérification en cours…
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Veuillez patienter pendant la vérification de votre email.
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-5">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold leading-none tracking-tight">
                Email vérifié !
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Votre adresse email a été confirmée. Redirection vers la connexion…
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-5">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold leading-none tracking-tight">
                Vérification échouée
              </h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-xs">
                {errorMessage}
              </p>
              <Link
                href="/verify-email"
                className="group relative inline-flex h-10 w-full mt-6 items-center justify-center overflow-hidden rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:ring-2 hover:ring-primary/20 hover:ring-offset-1 active:scale-[0.98]"
              >
                <span className="relative">Renvoyer un email de vérification</span>
              </Link>
            </>
          )}
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
