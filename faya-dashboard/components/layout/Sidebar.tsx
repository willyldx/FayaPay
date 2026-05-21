'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  KeyRound,
  Webhook,
  LogOut,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/authStore'
import type { NavItem } from '@/lib/types'

// =============================================================================
// Navigation items
// =============================================================================

const NAV_ITEMS: NavItem[] = [
  { label: 'Vue d\'ensemble', href: '/',             icon: 'LayoutDashboard' },
  { label: 'Transactions',    href: '/transactions',  icon: 'ArrowLeftRight' },
  { label: 'Clés API',        href: '/api-keys',      icon: 'KeyRound' },
  { label: 'Webhooks',        href: '/webhooks',      icon: 'Webhook' },
]

/** Map des icônes Lucide par nom */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ArrowLeftRight,
  KeyRound,
  Webhook,
}

// =============================================================================
// Sidebar — Desktop uniquement (hidden < lg)
// =============================================================================

export function Sidebar() {
  const pathname = usePathname()
  const merchant = useAuthStore((s) => s.merchant)
  const logout = useAuthStore((s) => s.logout)
  const isLoading = useAuthStore((s) => s.isLoading)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-slate-200 bg-white lg:flex">
      {/* --- Logo --- */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-faya-500 shadow-sm">
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
          Faya<span className="text-faya-500">Pay</span>
        </span>
      </div>

      {/* --- Navigation --- */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon]
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center gap-3 rounded-lg px-3 py-2.5
                    text-sm font-medium transition-all duration-150
                    ${
                      isActive
                        ? 'bg-faya-50 text-faya-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  {Icon && (
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-faya-500'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                  )}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* --- Profil merchant + Déconnexion --- */}
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
    </aside>
  )
}
