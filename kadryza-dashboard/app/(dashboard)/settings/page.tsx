'use client'

import { useState, useEffect } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2,
  Mail,
  Save,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import {
  updateProfileSchema,
  type UpdateProfileFormData,
  changePasswordSchema,
  type ChangePasswordFormData,
} from '@/lib/utils/validators'
import { useUpdateProfile, useChangePassword } from '@/lib/hooks/useSettings'
import { useAuthStore } from '@/lib/stores/authStore'
import { toast } from 'sonner'

// =============================================================================
// Page Paramètres du compte — /settings
// =============================================================================

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Paramètres du compte
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez les informations de votre compte et votre sécurité.
        </p>
      </div>

      <AccountInfoSection />
      <ChangePasswordSection />
      <DangerZoneSection />
    </div>
  )
}

// =============================================================================
// A. Informations du compte
// =============================================================================

function AccountInfoSection() {
  const merchant = useAuthStore((s) => s.merchant)
  const updateProfile = useUpdateProfile()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: merchant?.name ?? '' },
  })

  // Synchroniser le formulaire une fois le merchant hydraté
  useEffect(() => {
    if (merchant) reset({ name: merchant.name })
  }, [merchant, reset])

  const onSubmit = (data: UpdateProfileFormData) => {
    updateProfile.mutate(data, {
      onSuccess: () => reset(data), // remet l'état "dirty" à neuf
    })
  }

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Informations du compte
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Ces informations identifient votre entreprise sur Kadryza.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Nom de l'entreprise */}
        <div>
          <label htmlFor="settings-name" className="label">
            Nom de l&apos;entreprise
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="settings-name"
              type="text"
              placeholder="Ex: Acme Corp"
              className={`input pl-10 ${errors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              {...register('name')}
            />
          </div>
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        {/* Email (non modifiable) */}
        <div>
          <label htmlFor="settings-email" className="label">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="settings-email"
              type="email"
              value={merchant?.email ?? ''}
              disabled
              readOnly
              className="input pl-10 cursor-not-allowed bg-slate-50 text-slate-500"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Contactez le support pour changer votre email.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updateProfile.isPending || !isDirty}
            className="btn-primary"
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Sauvegarder les modifications
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

// =============================================================================
// B. Changer le mot de passe
// =============================================================================

function ChangePasswordSection() {
  const changePassword = useChangePassword()

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    },
  })

  const onSubmit = (data: ChangePasswordFormData) => {
    changePassword.mutate(
      { current_password: data.current_password, new_password: data.new_password },
      { onSuccess: () => reset() }
    )
  }

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Changer le mot de passe
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Utilisez un mot de passe fort que vous n&apos;utilisez pas ailleurs.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <PasswordField
          id="current-password"
          label="Mot de passe actuel"
          visible={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
          error={errors.current_password?.message}
          field={register('current_password')}
        />
        <PasswordField
          id="new-password"
          label="Nouveau mot de passe"
          visible={showNew}
          onToggle={() => setShowNew((v) => !v)}
          error={errors.new_password?.message}
          field={register('new_password')}
        />
        <PasswordField
          id="confirm-password"
          label="Confirmer le nouveau mot de passe"
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          error={errors.new_password_confirmation?.message}
          field={register('new_password_confirmation')}
        />

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="btn-primary"
          >
            {changePassword.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mise à jour…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Mettre à jour le mot de passe
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

// Champ mot de passe réutilisable avec bouton afficher/masquer
function PasswordField({
  id,
  label,
  visible,
  onToggle,
  error,
  field,
}: {
  id: string
  label: string
  visible: boolean
  onToggle: () => void
  error?: string
  field: UseFormRegisterReturn
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`input pl-10 pr-10 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
          {...field}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-0 top-0 flex h-full items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Masquer' : 'Afficher'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

// =============================================================================
// C. Danger Zone
// =============================================================================

function DangerZoneSection() {
  const [showDialog, setShowDialog] = useState(false)

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/50 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-red-700">Zone de danger</h2>
        <p className="mt-1 text-sm text-red-600/80">
          La suppression de votre compte est définitive et irréversible.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Supprimer mon compte</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Toutes vos données, clés API et webhooks seront supprimés.
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer mon compte
        </button>
      </div>

      <DeleteAccountDialog isOpen={showDialog} onClose={() => setShowDialog(false)} />
    </section>
  )
}

function DeleteAccountDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const CONFIRM_WORD = 'SUPPRIMER'
  const [confirmText, setConfirmText] = useState('')

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) setConfirmText('')
  }, [isOpen])

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
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (confirmText !== CONFIRM_WORD) return
    // Pas d'implémentation réelle pour l'instant.
    toast.info('Contactez le support pour supprimer votre compte.')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl animate-in">
        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          <h2 id="delete-account-title" className="text-center text-lg font-semibold text-slate-900">
            Supprimer votre compte ?
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Cette action est définitive et irréversible. Pour confirmer, saisissez{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-red-600">
              SUPPRIMER
            </code>{' '}
            ci-dessous.
          </p>

          <div className="mt-5">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              autoComplete="off"
              className="input text-center font-mono tracking-widest"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmText !== CONFIRM_WORD}
              className="btn-danger flex-1"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
