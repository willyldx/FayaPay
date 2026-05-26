"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Receipt, 
  Key, 
  Webhook, 
  LogOut,
  Zap,
  ChevronDown,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/lib/stores/authStore"
import { useUiStore } from "@/lib/stores/uiStore"
import { toast } from "sonner"

const navigation = [
  { name: "Vue d'ensemble", href: "/", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Clés API", href: "/api-keys", icon: Key },
  { name: "Webhooks", href: "/webhooks", icon: Webhook },
]

export function Sidebar() {
  const pathname = usePathname()
  const merchant = useAuthStore((s) => s.merchant)
  const logout = useAuthStore((s) => s.logout)
  const isLoading = useAuthStore((s) => s.isLoading)

  const { isSidebarCollapsed, toggleSidebar } = useUiStore()

  return (
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300", isSidebarCollapsed ? "w-[72px]" : "w-64")}>
      {/* Header / Logo */}
      <div className={cn("flex h-16 items-center border-b border-sidebar-border transition-all duration-300", isSidebarCollapsed ? "justify-center px-0" : "justify-between px-4")}>
        {!isSidebarCollapsed && (
          <Link href="/" className="flex items-center overflow-hidden">
            <Image src="/logo-dark.svg" alt="Kadryza" width={120} height={32} className="h-8 w-auto" />
          </Link>
        )}
        <button 
          onClick={toggleSidebar} 
          title={isSidebarCollapsed ? "Développer le menu" : "Réduire le menu"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-lg transition-colors",
                    isSidebarCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5 text-sm font-medium",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "shrink-0",
                    isSidebarCollapsed ? "h-6 w-6" : "h-5 w-5"
                  )} />
                  {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3">
        {merchant && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("flex w-full items-center rounded-lg transition-colors hover:bg-sidebar-accent/50", isSidebarCollapsed ? "justify-center py-2" : "gap-3 px-3 py-2.5 text-sm")}>
                <Avatar className={isSidebarCollapsed ? "h-9 w-9 shrink-0" : "h-8 w-8 shrink-0"}>
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold uppercase">
                    {merchant.name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {!isSidebarCollapsed && (
                  <>
                    <div className="flex-1 text-left overflow-hidden">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {merchant.name}
                      </p>
                      <p className="text-xs text-sidebar-muted truncate">
                        {merchant.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-sidebar-muted shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => toast.info('Paramètres du compte : Bientôt disponible')}>
                Paramètres du compte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Support : Bientôt disponible')}>
                Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive cursor-pointer" 
                onClick={logout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  )
}
