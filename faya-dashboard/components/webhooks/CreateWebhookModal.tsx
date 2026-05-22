'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Link as LinkIcon,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createWebhookSchema,
  type CreateWebhookFormData,
} from '@/lib/utils/validators'
import { useCreateWebhook } from '@/lib/hooks/useWebhooks'

// =============================================================================
// CreateWebhookModal — Création webhook (secret visible UNE SEULE FOIS)
// =============================================================================

interface CreateWebhookModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModalStep = 'create' | 'reveal'

export function CreateWebhookModal({ isOpen, onClose }: CreateWebhookModalProps) {
  const createMutation = useCreateWebhook()

  const [step, setStep] = useState<ModalStep>('create')
  const [secret, setSecret] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [secretVisible, setSecretVisible] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
  } = useForm<CreateWebhookFormData>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: { url: '' },
  })

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setStep('create')
      setSecret('')
      setWebhookUrl('')
      setCopied(false)
      setConfirmed(false)
      setSecretVisible(false)
      resetForm()
      createMutation.reset()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const onSubmit = async (data: CreateWebhookFormData) => {
    try {
      const result = await createMutation.mutateAsync({ url: data.url })
      if (result.secret) {
        setSecret(result.secret)
        setWebhookUrl(data.url)
        setStep('reveal')
      }
    } catch {
      // toast géré par le hook
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleClose = () => {
    if (step === 'reveal' && !confirmed) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={step === 'create' ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl animate-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {step === 'create' ? 'Ajouter un endpoint' : 'Secret du webhook'}
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
            /* ========== Étape 1 : URL ========== */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="webhook-url" className="label">
                  URL de l&apos;endpoint
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="webhook-url"
                    type="url"
                    placeholder="https://votre-site.com/webhooks/fayapay"
                    className={`input pl-10 ${errors.url ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    {...register('url')}
                  />
                </div>
                {errors.url && (
                  <p className="field-error">{errors.url.message}</p>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  L&apos;URL doit utiliser HTTPS et être publiquement accessible.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création…
                    </>
                  ) : (
                    'Créer l\'endpoint'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ========== Étape 2 : Secret ========== */
            <div className="space-y-5">
              {/* Avertissement */}
              <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                <div className="flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Sauvegardez ce secret maintenant !
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      Ce secret ne sera <strong>plus jamais affiché</strong> après fermeture.
                      Utilisez-le pour vérifier la signature HMAC des webhooks reçus.
                    </p>
                  </div>
                </div>
              </div>

              {/* URL confirmée */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Endpoint configuré
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <code className="text-sm font-mono text-slate-700 break-all">
                    {webhookUrl}
                  </code>
                </div>
              </div>

              {/* Secret */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Secret de signature
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
                    <code className="flex-1 text-sm font-mono text-slate-900 break-all select-all">
                      {secretVisible
                        ? secret
                        : secret.slice(0, 8) + '•'.repeat(Math.max(0, secret.length - 8))}
                    </code>
                    <button
                      onClick={() => setSecretVisible(!secretVisible)}
                      className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                      aria-label={secretVisible ? 'Masquer' : 'Afficher'}
                    >
                      {secretVisible ? (
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
                      ✓ Secret copié dans le presse-papier
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
                  J&apos;ai copié le secret et je comprends qu&apos;il ne sera plus affiché
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
