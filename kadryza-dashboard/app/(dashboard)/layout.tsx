'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUiStore } from '@/lib/stores/uiStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Dashboard Layout — Sidebar (desktop) + Header (mobile) + contenu
// =============================================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hydrate = useAuthStore((s) => s.hydrate)
  const isHydrated = useAuthStore((s) => s.isHydrated)

  // Hydrater le store auth au montage
  useEffect(() => {
    hydrate()
  }, [hydrate])

  const isSidebarCollapsed = useUiStore((s) => s.isSidebarCollapsed)

  // Skeleton pendant l'hydratation
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card animate-in fade-in zoom-in duration-500">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium text-slate-500 animate-pulse">Chargement de l'interface...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — Desktop (hidden mobile) */}
      <Sidebar />

      {/* Zone principale */}
      <div className={cn("flex flex-1 flex-col transition-all duration-300", isSidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        {/* Header — Mobile (hidden desktop) */}
        <Header />

        {/* Contenu de la page */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
