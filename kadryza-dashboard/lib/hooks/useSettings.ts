'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMerchantProfile, changePassword } from '@/lib/api/merchants'
import { useAuthStore } from '@/lib/stores/authStore'
import { toast } from 'sonner'

// =============================================================================
// Hooks Paramètres du compte
// =============================================================================

/**
 * Mise à jour du profil merchant (nom).
 * Synchronise le store auth après succès.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const setMerchant = useAuthStore((s) => s.setMerchant)

  return useMutation({
    mutationFn: (data: { name: string }) => updateMerchantProfile(data),
    onSuccess: (merchant) => {
      setMerchant(merchant)
      queryClient.invalidateQueries({ queryKey: ['merchant'] })
      toast.success('Informations mises à jour')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour')
    },
  })
}

/**
 * Changement de mot de passe.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      changePassword(data),
    onSuccess: () => {
      toast.success('Mot de passe mis à jour avec succès')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Erreur lors du changement de mot de passe'
      )
    },
  })
}
