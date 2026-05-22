'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { setQueryClientRef } from '@/lib/stores/authStore'

// =============================================================================
// Providers — Client Components wrapper
// =============================================================================

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient créé une seule fois par instance (pas recréé à chaque render)
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            // Retry 1 fois sur erreur réseau, pas sur 4xx
            retry: (failureCount, error) => {
              if (error instanceof Error && 'status' in error) {
                const status = (error as { status: number }).status
                // Pas de retry sur 401, 403, 404
                if (status === 401 || status === 403 || status === 404) {
                  return false
                }
              }
              return failureCount < 1
            },
            // Ne pas refetch quand la fenêtre reprend le focus
            // (sauf pour useDashboardStats qui override)
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      })
      // [H-3] Lier le QueryClient au store auth pour clear au logout
      setQueryClientRef(client)
      return client
    }
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          },
          classNames: {
            success: 'border-green-200 bg-green-50 text-green-800',
            error: 'border-red-200 bg-red-50 text-red-800',
            info: 'border-blue-200 bg-blue-50 text-blue-800',
          },
        }}
        richColors
        closeButton
      />
    </QueryClientProvider>
  )
}
