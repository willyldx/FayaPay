'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { getCheckout, payCheckout, getCheckoutStatus } from '@/lib/api/checkout'
import type { CheckoutView, TransactionStatus } from '@/lib/types'

// =============================================================================
// Page de checkout hébergée (publique) — /pay/[slug]
// =============================================================================

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
}

const OPERATORS = [
  { value: 'AIRTEL', label: 'Airtel Money' },
  { value: 'MOOV', label: 'Moov Money' },
]

type Step = 'loading' | 'unavailable' | 'form' | 'processing' | 'success' | 'failed'

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const [step, setStep] = useState<Step>('loading')
  const [view, setView] = useState<CheckoutView | null>(null)
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState('AIRTEL')
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Charger le lien ---
  useEffect(() => {
    let active = true
    getCheckout(slug)
      .then((v) => {
        if (!active) return
        setView(v)
        setStep(v.is_payable ? 'form' : 'unavailable')
      })
      .catch(() => active && setStep('unavailable'))
    return () => {
      active = false
    }
  }, [slug])

  // --- Nettoyage du polling ---
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = useCallback((txId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await getCheckoutStatus(txId)
        const status = s.status as TransactionStatus
        if (status === 'SUCCESS') {
          if (pollRef.current) clearInterval(pollRef.current)
          setStep('success')
        } else if (status === 'FAILED' || status === 'TIMEOUT') {
          if (pollRef.current) clearInterval(pollRef.current)
          setError(
            status === 'TIMEOUT'
              ? 'Le délai de paiement a expiré. Veuillez réessayer.'
              : s.failure_reason || 'Le paiement a échoué. Veuillez réessayer.'
          )
          setStep('failed')
        } else if (status === 'WAITING_SMS') {
          setStatusMsg('Confirmez le paiement sur votre téléphone…')
        }
      } catch {
        // ignore transient polling errors
      }
    }, 3000)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (phone.trim().length < 6) {
      setError('Veuillez saisir un numéro de téléphone valide.')
      return
    }
    setStep('processing')
    setStatusMsg('Initialisation du paiement…')
    try {
      const res = await payCheckout(slug, {
        phone_number: phone.trim(),
        operator,
      })
      setStatusMsg('Confirmez le paiement sur votre téléphone…')
      startPolling(res.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'initier le paiement.')
      setStep('form')
    }
  }

  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.svg" alt="Kadryza" className="h-8 w-auto" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          {step === 'loading' && (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-kadryza-500" />
              <p className="mt-3 text-sm text-slate-500">Chargement…</p>
            </div>
          )}

          {step === 'unavailable' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <AlertTriangle className="h-6 w-6 text-slate-400" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Lien indisponible</h1>
              <p className="mt-1 text-sm text-slate-500">
                Ce lien de paiement n&apos;existe pas, a expiré ou a été désactivé.
              </p>
            </div>
          )}

          {(step === 'form' || step === 'processing') && view && (
            <>
              {/* Détails */}
              <div className="text-center">
                <p className="text-sm text-slate-500">{view.merchant_name}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  {formatXAF(view.amount)}
                </p>
                {view.description && (
                  <p className="mt-1 text-sm text-slate-500">{view.description}</p>
                )}
              </div>

              <div className="my-6 h-px bg-slate-100" />

              {step === 'processing' ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-kadryza-500" />
                  <p className="mt-4 text-sm font-medium text-slate-900">
                    {statusMsg || 'Paiement en cours…'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Validez la demande reçue sur votre téléphone ({operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money'}).
                    Ne fermez pas cette page.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Opérateur */}
                  <div>
                    <label className="label">Opérateur</label>
                    <div className="grid grid-cols-2 gap-3">
                      {OPERATORS.map((op) => (
                        <button
                          key={op.value}
                          type="button"
                          onClick={() => setOperator(op.value)}
                          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                            operator === op.value
                              ? 'border-kadryza-500 bg-kadryza-50 text-kadryza-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label htmlFor="phone" className="label">
                      Numéro de téléphone
                    </label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="Ex: 66 00 00 00"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`input pl-10 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                      />
                    </div>
                    {error && <p className="field-error">{error}</p>}
                  </div>

                  <button type="submit" className="btn-primary w-full">
                    Payer {formatXAF(view.amount)}
                  </button>
                </form>
              )}
            </>
          )}

          {step === 'success' && view && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Paiement réussi</h1>
              <p className="mt-1 text-sm text-slate-500">
                Votre paiement de <strong>{formatXAF(view.amount)}</strong> à {view.merchant_name} a été confirmé.
              </p>
            </div>
          )}

          {step === 'failed' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-7 w-7 text-red-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Paiement échoué</h1>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
              <button onClick={() => setStep('form')} className="btn-secondary mt-5">
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Footer trust */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Paiement sécurisé par Kadryza
        </div>
      </div>
    </div>
  )
}
