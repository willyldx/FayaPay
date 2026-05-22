'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/lib/utils/validators'
import { login } from '@/lib/api/merchants'
import { useAuthStore } from '@/lib/stores/authStore'

// =============================================================================
// Page Login — Suspense boundary pour useSearchParams (Next.js 14)
// =============================================================================

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 h-[420px] animate-pulse" />}>
      <LoginForm />
    </Suspense>
  )
}

// =============================================================================
// LoginForm — Formulaire de connexion
// =============================================================================

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setMerchant = useAuthStore((s) => s.setMerchant)

  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await login(data)
      setMerchant(response.merchant)

      // [C-1 FIX] Valider que la redirection est un chemin local (pas d'URL absolue)
      // Empêche les open redirect attacks via ?redirect=https://evil.com
      const rawRedirect = searchParams.get('redirect') ?? '/'
      const redirect =
        rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
          ? rawRedirect
          : '/'
      router.push(redirect)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Identifiants invalides ou compte inactif')
      }
    }
  }

  return (
    <div className="card p-8 animate-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Connexion
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Accédez à votre espace merchant FayaPay
        </p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="login-email" className="label">
            Adresse email
          </label>
          <input
            id="login-email"
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
          <label htmlFor="login-password" className="label">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`input pr-11 ${errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="field-error">{errors.password.message}</p>
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
              Connexion en cours…
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>

      {/* Lien inscription */}
      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="font-medium text-faya-500 hover:text-faya-600 transition-colors"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
