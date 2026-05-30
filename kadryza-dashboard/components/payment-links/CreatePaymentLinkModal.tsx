'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Coins } from 'lucide-react'
import { useCreatePaymentLink } from '@/lib/hooks/usePaymentLinks'

// =============================================================================
// CreatePaymentLinkModal — Création d'un lien de paiement
// =============================================================================

interface CreatePaymentLinkModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreatePaymentLinkModal({ isOpen, onClose }: CreatePaymentLinkModalProps) {
  const createMutation = useCreatePaymentLink()

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [isReusable, setIsReusable] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setDescription('')
      setIsReusable(true)
      setError('')
      createMutation.reset()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const amt = Number.parseInt(amount, 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Le montant doit être un entier positif (en XAF).')
      return
    }
    try {
      await createMutation.mutateAsync({
        amount: amt,
        description: description.trim() || undefined,
        is_reusable: isReusable,
      })
      onClose()
    } catch {
      // toast géré par le hook
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-link-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl animate-in">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="create-link-title" className="text-lg font-semibold text-slate-900">
            Nouveau lien de paiement
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5" noValidate>
          {/* Montant */}
          <div>
            <label htmlFor="link-amount" className="label">
              Montant (XAF)
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="link-amount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Ex: 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`input pl-10 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
            </div>
            {error && <p className="field-error">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="link-description" className="label">
              Description <span className="text-slate-400">(optionnel)</span>
            </label>
            <input
              id="link-description"
              type="text"
              maxLength={255}
              placeholder="Ex: Abonnement mensuel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
            />
          </div>

          {/* Réutilisable */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isReusable}
              onChange={(e) => setIsReusable(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-kadryza-500 focus:ring-kadryza-500"
            />
            <span className="text-sm text-slate-700">
              Lien réutilisable
              <span className="block text-xs text-slate-400">
                Peut être payé plusieurs fois. Décochez pour un usage unique.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création…
                </>
              ) : (
                'Créer le lien'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
