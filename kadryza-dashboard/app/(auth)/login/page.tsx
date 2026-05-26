'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/lib/utils/validators'
import { login } from '@/lib/api/merchants'
import { setAuthToken } from '@/lib/api/client'
import { useAuthStore } from '@/lib/stores/authStore'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-[350px] w-full animate-pulse rounded-xl border bg-card shadow-sm" />}>
      <LoginForm />
    </Suspense>
  )
}

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
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await login(data)
      setAuthToken(response.token, response.expires_at)
      setMerchant(response.merchant)
      const rawRedirect = searchParams.get('redirect') ?? '/'
      const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'
      router.push(redirect)
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'EMAIL_NOT_VERIFIED') {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Email non vérifié</span>
            <a href={`/verify-email?email=${encodeURIComponent(data.email)}`} className="text-primary underline underline-offset-2 text-xs">
              Renvoyer l&apos;email de vérification →
            </a>
          </div>,
          { duration: 8000 }
        )
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Identifiants invalides ou compte inactif')
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <h1 className="text-xl font-semibold leading-none tracking-tight">Connexion</h1>
          <p className="text-sm text-muted-foreground">Entrez vos identifiants pour accéder à votre espace.</p>
        </div>
        <div className="p-6 pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="m@example.com"
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                {...register('email')}
              />
              {errors.email && <p className="text-[0.8rem] font-medium text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <label htmlFor="login-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Mot de passe
                </label>
                <Link href="/forgot-password" className="ml-auto inline-block text-sm underline underline-offset-4 hover:text-primary">
                  Oublié?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              {errors.password && <p className="text-[0.8rem] font-medium text-destructive">{errors.password.message}</p>}
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
                    Connexion...
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/register" className="underline underline-offset-4 hover:text-primary">
          S&apos;inscrire
        </Link>
      </div>
    </div>
  )
}
