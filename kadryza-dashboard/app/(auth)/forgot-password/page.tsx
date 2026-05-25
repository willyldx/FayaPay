'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Mail, ArrowLeft } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/utils/validators'
import { forgotPassword } from '@/lib/api/merchants'

// =============================================================================
// Page Mot de passe oublié
// =============================================================================

export default function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword(data.email)
      setEmailSent(true)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Une erreur est survenue. Réessayez plus tard.')
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        {emailSent ? (
          /* ========== État : Email envoyé ========== */
          <div className="p-6 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-5">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold leading-none tracking-tight">
              Email envoyé !
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation dans quelques minutes.
            </p>
            <Link
              href="/login"
              className="group relative inline-flex h-10 w-full mt-6 items-center justify-center overflow-hidden rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:ring-2 hover:ring-primary/20 hover:ring-offset-1 active:scale-[0.98]"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                <div className="relative h-full w-12 bg-white/20" />
              </div>
              <span className="relative flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </span>
            </Link>
          </div>
        ) : (
          /* ========== État : Formulaire ========== */
          <>
            <div className="flex flex-col space-y-1.5 p-6 pb-4">
              <h1 className="text-xl font-semibold leading-none tracking-tight">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
            </div>
            <div className="p-6 pt-0">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <label htmlFor="forgot-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
                    className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    {...register('email')}
                  />
                  {errors.email && <p className="text-[0.8rem] font-medium text-destructive">{errors.email.message}</p>}
                </div>

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
                        Envoi en cours…
                      </>
                    ) : (
                      <>
                        Envoyer le lien
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
              </form>
            </div>
          </>
        )}
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
