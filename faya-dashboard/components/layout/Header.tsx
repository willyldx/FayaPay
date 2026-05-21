'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import { MobileNav } from './MobileNav'

// =============================================================================
// Header — Mobile uniquement (hidden >= lg)
// =============================================================================

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const merchant = useAuthStore((s) => s.merchant)

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 lg:hidden">
        {/* Hamburger */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg
                     text-slate-600 transition-colors hover:bg-slate-100"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo central */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-faya-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4.5 w-4.5 text-white"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            Faya<span className="text-faya-500">Pay</span>
          </span>
        </div>

        {/* Avatar merchant */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-faya-100 text-faya-600">
          <span className="text-sm font-semibold">
            {merchant?.name?.charAt(0).toUpperCase() ?? 'M'}
          </span>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileNav isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}
