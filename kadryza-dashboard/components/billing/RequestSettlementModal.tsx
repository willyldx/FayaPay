'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Banknote } from 'lucide-react'
import { useCreateSettlement } from '@/lib/hooks/useBilling'

// =============================================================================
// RequestSettlementModal — Demander un retrait
// =============================================================================

interface RequestSettlementModalProps {
  isOpen: boolean
  onClose: () => void
  available: number
}

const METHODS = [
  { value: 'AIRTEL', label: 'Airtel Money' },
  { value: 'MOOV', label: 'Moov Money' },
  { value: 'BANK', label: 'Virement bancaire' },
]

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
}

export function RequestSettlementModal({ isOpen, onClose, available }: RequestSettlementModalProps) {
  const createMutation = useCreateSettlement()

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('AIRTEL')
  const [destination, setDestination] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setMethod('AIRTEL')
      setDestination('')
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
      setError('Le montant doit être un entier positif.')
      return
    }
    if (amt > available) {
      setError(`Montant supérieur au solde disponible (${formatXAF(available)}).`)
      return
    }
    if (destination.trim().length < 4) {
      setError('Veuillez saisir une destination valide (numéro ou compte).')
      return
    }
    try {
      await createMutation.mutateAsync({ amount: amt, method, destination: destination.trim() })
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
      aria-labelledby="settlement-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl animate-in">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="settlement-title" className="text-lg font-semibold text-slate-900">
            Demander un retrait
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-500">Disponible : </span>
            <span className="font-semibold text-slate-900">{formatXAF(available)}</span>
          </div>

          {/* Montant */}
          <div>
            <label htmlFor="settlement-amount" className="label">
              Montant (XAF)
            </label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="settlement-amount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Ex: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`input pl-10 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
            </div>
          </div>

          {/* Méthode */}
          <div>
            <label htmlFor="settlement-method" className="label">
              Méthode de retrait
            </label>
            <select
              id="settlement-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="input"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div>
            <label htmlFor="settlement-destination" className="label">
              {method === 'BANK' ? 'Numéro de compte / IBAN' : 'Numéro mobile money'}
            </label>
            <input
              id="settlement-destination"
              type="text"
              placeholder={method === 'BANK' ? 'Ex: TD00 0000 0000' : 'Ex: 66 00 00 00'}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="input"
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : (
                'Demander le retrait'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
