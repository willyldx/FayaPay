'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUiStore } from '@/lib/stores/uiStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-kadryza-500 animate-pulse" />
          <div className="h-2 w-24 rounded-full skeleton" />
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
