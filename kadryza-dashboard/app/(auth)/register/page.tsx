'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { registerSchema, type RegisterFormData } from '@/lib/utils/validators'
import { register as apiRegister } from '@/lib/api/merchants'

// =============================================================================
// Page Register
// =============================================================================

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await apiRegister(data)
      toast.success('Compte créé avec succès ! Connectez-vous pour continuer.')
      router.push('/login')
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Erreur lors de la création du compte')
      }
    }
  }

  return (
    <div className="card p-8 animate-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Créer un compte
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Inscrivez votre entreprise sur Kadryza
        </p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Nom entreprise */}
        <div>
          <label htmlFor="register-name" className="label">
            Nom de l&apos;entreprise
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="organization"
            placeholder="Ma Super Entreprise"
            className={`input ${errors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            {...register('name')}
          />
          {errors.name && (
            <p className="field-error">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="register-email" className="label">
            Adresse email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="vous@entreprise.com"
            className={`input ${errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            {...register('email')}
          />
          {errors.email && (
            <p className="field-error">{errors.email.message}</p>
          )}
        </div>

        {/* Mot de passe */}
        <div>
          <label htmlFor="register-password" className="label">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 caractères"
              className={`input pr-11 ${errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
          )}
          <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
            <li>• Au moins 8 caractères</li>
            <li>• Une majuscule, une minuscule, un chiffre</li>
          </ul>
        </div>

        {/* Confirmation mot de passe */}
        <div>
          <label htmlFor="register-confirm" className="label">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <input
              id="register-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`input pr-11 ${errors.password_confirmation ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              {...register('password_confirmation')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              aria-label={showConfirm ? 'Masquer' : 'Afficher'}
            >
              {showConfirm ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          {errors.password_confirmation && (
            <p className="field-error">{errors.password_confirmation.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Création en cours…
            </>
          ) : (
            'Créer mon compte'
          )}
        </button>
      </form>

      {/* Lien login */}
      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="font-medium text-kadryza-500 hover:text-kadryza-600 transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
