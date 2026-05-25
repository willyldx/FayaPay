'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/utils/validators'
import { resetPassword } from '@/lib/api/merchants'

// =============================================================================
// Page Réinitialisation du mot de passe
// =============================================================================

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', password_confirmation: '' },
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword(params.token, data.password)
      toast.success('Mot de passe modifié ! Connectez-vous avec votre nouveau mot de passe.')
      router.push('/login')
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Le lien de réinitialisation est invalide ou a expiré.')
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <h1 className="text-xl font-semibold leading-none tracking-tight">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground">Choisissez un nouveau mot de passe sécurisé.</p>
        </div>
        <div className="p-6 pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Nouveau mot de passe */}
            <div className="space-y-2">
              <label htmlFor="reset-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              {errors.password && <p className="text-[0.8rem] font-medium text-destructive">{errors.password.message}</p>}
            </div>

            {/* Confirmation */}
            <div className="space-y-2">
              <label htmlFor="reset-confirm" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  id="reset-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.password_confirmation ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('password_confirmation')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              {errors.password_confirmation && <p className="text-[0.8rem] font-medium text-destructive">{errors.password_confirmation.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative inline-flex h-10 w-full mt-2 items-center justify-center overflow-hidden rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:ring-2 hover:ring-primary/20 hover:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                <div className="relative h-full w-12 bg-white/20" />
              </div>
              <span className="relative flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Modification…
                  </>
                ) : (
                  <>
                    Réinitialiser le mot de passe
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </span>
            </button>
          </form>
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
