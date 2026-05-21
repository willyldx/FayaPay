import { z } from 'zod'

// =============================================================================
// Schémas Zod — Authentification
// =============================================================================

/** Validation formulaire de connexion */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('Adresse email invalide'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis'),
})

export type LoginFormData = z.infer<typeof loginSchema>

/** Validation formulaire d'inscription */
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Le nom de l\'entreprise est requis')
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    email: z
      .string()
      .min(1, 'L\'email est requis')
      .email('Adresse email invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .regex(
        /[A-Z]/,
        'Le mot de passe doit contenir au moins une majuscule'
      )
      .regex(
        /[a-z]/,
        'Le mot de passe doit contenir au moins une minuscule'
      )
      .regex(
        /[0-9]/,
        'Le mot de passe doit contenir au moins un chiffre'
      ),
    password_confirmation: z
      .string()
      .min(1, 'La confirmation du mot de passe est requise'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['password_confirmation'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>

// =============================================================================
// Schémas Zod — Webhooks
// =============================================================================

/** Validation création d'un endpoint webhook */
export const createWebhookSchema = z.object({
  url: z
    .string()
    .min(1, 'L\'URL est requise')
    .url('L\'URL n\'est pas valide')
    .startsWith('https://', 'L\'URL doit utiliser HTTPS'),
})

export type CreateWebhookFormData = z.infer<typeof createWebhookSchema>

// =============================================================================
// Schémas Zod — Clés API
// =============================================================================

/** Validation création d'une clé API (label optionnel) */
export const createApiKeySchema = z.object({
  label: z
    .string()
    .max(50, 'Le label ne peut pas dépasser 50 caractères')
    .optional(),
})

export type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>
