import { create } from 'zustand'
import type { Merchant } from '@/lib/types'
import { getProfile, logout as apiLogout } from '@/lib/api/merchants'

// =============================================================================
// Auth Store — Zustand
// =============================================================================

interface AuthState {
  /** Merchant connecté (null si non authentifié) */
  merchant: Merchant | null
  /** Indique si l'hydratation initiale est terminée */
  isHydrated: boolean
  /** Indique si une opération d'auth est en cours */
  isLoading: boolean
}

interface AuthActions {
  /** Met à jour le merchant dans le store */
  setMerchant: (merchant: Merchant) => void
  /** Déconnexion : appel API + nettoyage du store + redirect */
  logout: () => Promise<void>
  /** Hydrate le store au montage en récupérant le profil depuis le cookie JWT */
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // --- État initial ---
  merchant: null,
  isHydrated: false,
  isLoading: false,

  // --- Actions ---

  setMerchant: (merchant) => {
    set({ merchant })
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await apiLogout()
    } catch {
      // Même si l'appel API échoue, on nettoie le state local
    } finally {
      set({ merchant: null, isLoading: false })
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  },

  hydrate: async () => {
    // Éviter de re-hydrater si déjà fait
    if (useAuthStore.getState().isHydrated) return

    set({ isLoading: true })
    try {
      // Le cookie JWT httpOnly est envoyé automatiquement par le navigateur.
      // Si le cookie est valide, on récupère le profil merchant.
      const merchant = await getProfile()
      set({ merchant, isHydrated: true, isLoading: false })
    } catch {
      // Pas de cookie valide ou erreur réseau → pas de merchant
      set({ merchant: null, isHydrated: true, isLoading: false })
    }
  },
}))
