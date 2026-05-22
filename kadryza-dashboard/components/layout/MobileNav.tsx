'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  X,
  LayoutDashboard,
  ArrowLeftRight,
  KeyRound,
  Webhook,
  LogOut,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'

// =============================================================================
// Items de navigation (identiques à Sidebar)
// =============================================================================

const NAV_ITEMS = [
  { label: 'Vue d\'ensemble', href: '/',             Icon: LayoutDashboard },
  { label: 'Transactions',    href: '/transactions',  Icon: ArrowLeftRight },
  { label: 'Clés API',        href: '/api-keys',      Icon: KeyRound },
  { label: 'Webhooks',        href: '/webhooks',      Icon: Webhook },
]

// =============================================================================
// MobileNav — Drawer latéral
// =============================================================================

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const merchant = useAuthStore((s) => s.merchant)
  const logout = useAuthStore((s) => s.logout)
  const isLoading = useAuthStore((s) => s.isLoading)

  // Fermer quand on change de route
  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  // Empêcher le scroll du body quand le drawer est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header du drawer */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kadryza-500 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-white"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Kadryza
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg
                       text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ label, href, Icon }) => {
              const isActive =
                href === '/' ? pathname === '/' : pathname.startsWith(href)

              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`
                      group flex items-center gap-3 rounded-lg px-3 py-3
                      text-sm font-medium transition-all duration-150
                      ${
                        isActive
                          ? 'bg-kadryza-50 text-kadryza-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-kadryza-500'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profil + Déconnexion */}
        <div className="border-t border-slate-200 px-3 py-4">
          {merchant && (
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-medium text-slate-900 truncate">
                {merchant.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {merchant.email}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            disabled={isLoading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                       text-sm font-medium text-slate-600
                       transition-colors duration-150
                       hover:bg-red-50 hover:text-red-600
                       disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
