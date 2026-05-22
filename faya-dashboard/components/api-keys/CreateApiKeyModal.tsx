'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useCreateApiKey } from '@/lib/hooks/useApiKeys'

// =============================================================================
// CreateApiKeyModal — Création clé API (clé visible UNE SEULE FOIS)
// =============================================================================

interface CreateApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModalStep = 'create' | 'reveal'

export function CreateApiKeyModal({ isOpen, onClose }: CreateApiKeyModalProps) {
  const createMutation = useCreateApiKey()

  const [step, setStep] = useState<ModalStep>('create')
  const [label, setLabel] = useState('')
  const [fullKey, setFullKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setStep('create')
      setLabel('')
      setFullKey('')
      setCopied(false)
      setConfirmed(false)
      setKeyVisible(false)
      createMutation.reset()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Empêcher scroll body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleCreate = async () => {
    // [M-4 FIX] Guard contre le double-click
    if (createMutation.isPending) return
    try {
      const result = await createMutation.mutateAsync(label || undefined)
      if (result.full_key) {
        setFullKey(result.full_key)
        setStep('reveal')
      }
    } catch {
      // Erreur gérée par le hook (toast)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(fullKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleClose = () => {
    // Sur l'étape reveal, bloquer si pas confirmé
    if (step === 'reveal' && !confirmed) return
    // [M-6 FIX] Effacer le secret de la mémoire immédiatement
    setFullKey('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-apikey-title"
    >
      {/* Overlay — ne ferme PAS sur click si on est sur reveal sans confirmation */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={step === 'create' ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl animate-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {step === 'create' ? 'Créer une clé API' : 'Votre nouvelle clé API'}
          </h2>
          {step === 'create' && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="px-6 py-5">
          {step === 'create' ? (
            /* ========== Étape 1 : Création ========== */
            <div className="space-y-4">
              <div>
                <label htmlFor="apikey-label" className="label">
                  Label (optionnel)
                </label>
                <input
                  id="apikey-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Production, Staging…"
                  className="input"
                  maxLength={50}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Un nom pour identifier cette clé facilement
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="btn-secondary">
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création…
                    </>
                  ) : (
                    'Créer la clé'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ========== Étape 2 : Révélation clé ========== */
            <div className="space-y-5">
              {/* Avertissement critique */}
              <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Sauvegardez cette clé maintenant !
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      Cette clé ne sera <strong>plus jamais affichée</strong> après
                      fermeture de cette fenêtre. Copiez-la et stockez-la dans un
                      endroit sécurisé (variables d&apos;environnement, gestionnaire de secrets).
                    </p>
                  </div>
                </div>
              </div>

              {/* Clé */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Votre clé API
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
                    <code className="flex-1 text-sm font-mono text-slate-900 break-all select-all">
                      {keyVisible
                        ? fullKey
                        : fullKey.slice(0, 12) + '•'.repeat(Math.max(0, fullKey.length - 12))}
                    </code>
                    <button
                      onClick={() => setKeyVisible(!keyVisible)}
                      className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                      aria-label={keyVisible ? 'Masquer' : 'Afficher'}
                    >
                      {keyVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                      aria-label="Copier"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="mt-1.5 text-xs font-medium text-green-600">
                      ✓ Clé copiée dans le presse-papier
                    </p>
                  )}
                </div>
              </div>

              {/* Checkbox confirmation */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-faya-500 focus:ring-faya-500"
                />
                <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                  J&apos;ai copié ma clé API et je comprends qu&apos;elle ne sera plus affichée
                </span>
              </label>

              {/* Bouton fermer */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleClose}
                  disabled={!confirmed}
                  className="btn-primary"
                >
                  Fermer
                </button>
              </div>

              {!confirmed && (
                <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Cochez la case ci-dessus pour pouvoir fermer
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
