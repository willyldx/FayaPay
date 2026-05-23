import { create } from 'zustand'
import type { Merchant } from '@/lib/types'
import { getProfile, logout as apiLogout } from '@/lib/api/merchants'
import { getAuthToken, clearAuthToken } from '@/lib/api/client'
import type { QueryClient } from '@tanstack/react-query'

// =============================================================================
// Auth Store — Zustand
// =============================================================================

// [H-3 FIX] Référence au QueryClient pour clear le cache au logout
let queryClientRef: QueryClient | null = null

/** Appelé par Providers au montage pour lier le QueryClient au store */
export function setQueryClientRef(client: QueryClient) {
  queryClientRef = client
}

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
  /** Déconnexion : appel API + nettoyage du store + clear cache + redirect */
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
      clearAuthToken()  // Supprimer le cookie JWT
      set({ merchant: null, isLoading: false })
      // [H-3 FIX] Vider tout le cache de données de l'ancien merchant
      queryClientRef?.clear()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  },

  hydrate: async () => {
    // Éviter de re-hydrater si déjà fait
    if (useAuthStore.getState().isHydrated) return

    // Si pas de token en cookie, pas la peine d'appeler l'API
    const token = getAuthToken()
    if (!token) {
      set({ merchant: null, isHydrated: true, isLoading: false })
      return
    }

    set({ isLoading: true })
    try {
      // Le token est envoyé en Authorization: Bearer via apiClient
      const merchant = await getProfile()
      set({ merchant, isHydrated: true, isLoading: false })
    } catch {
      // JWT expiré ou invalide → nettoyer le cookie corrompu
      clearAuthToken()
      set({ merchant: null, isHydrated: true, isLoading: false })
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  },
}))
