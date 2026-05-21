import type { Metadata } from 'next'

// =============================================================================
// Auth Layout — Centré, fond gris clair, logo FayaPay
// =============================================================================

export const metadata: Metadata = {
  title: 'Authentification | FayaPay',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      {/* Logo FayaPay */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-faya-500 shadow-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6 text-white"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          Faya<span className="text-faya-500">Pay</span>
        </span>
      </div>

      {/* Contenu (formulaire login ou register) */}
      <div className="w-full max-w-[420px]">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} FayaPay. Tous droits réservés.
      </p>
    </div>
  )
}
