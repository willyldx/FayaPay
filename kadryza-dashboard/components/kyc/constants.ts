import type {
  BusinessType,
  KYCDocumentStatus,
  KYCDocumentType,
  KYCStatus,
} from '@/lib/types'

// =============================================================================
// Libellés & contraintes KYC (FR)
// =============================================================================

/** Contraintes d'upload — alignées sur le backend (allowedKYCMimeTypes / 10 Mo). */
export const KYC_ACCEPTED_MIME = 'image/jpeg,image/png,image/webp,application/pdf'
export const KYC_MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 Mo

/** Affichage du statut KYC global. */
export const KYC_STATUS_DISPLAY: Record<
  KYCStatus,
  { label: string; className: string }
> = {
  unverified: { label: 'Non vérifié', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending: { label: 'En cours d’examen', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  verified: { label: 'Vérifié', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-700 border-red-200' },
}

/** Affichage du statut d'un document. */
export const KYC_DOC_STATUS_DISPLAY: Record<
  KYCDocumentStatus,
  { label: string; className: string }
> = {
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approuvé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejeté', className: 'bg-red-50 text-red-700 border-red-200' },
}

/** Libellés des types de documents. */
export const KYC_DOC_TYPE_LABELS: Record<KYCDocumentType, string> = {
  ID_CARD: 'Carte d’identité (CNI)',
  PASSPORT: 'Passeport',
  RCCM: 'Registre du commerce (RCCM)',
  NIF: 'Numéro d’identification fiscale (NIF)',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  SELFIE: 'Selfie / photo',
  OTHER: 'Autre document',
}

/** Ordre d'affichage des types de documents dans le select. */
export const KYC_DOC_TYPE_OPTIONS: KYCDocumentType[] = [
  'ID_CARD',
  'PASSPORT',
  'RCCM',
  'NIF',
  'PROOF_OF_ADDRESS',
  'SELFIE',
  'OTHER',
]

/** Libellés des types de business. */
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  individual: 'Particulier / Entreprise individuelle',
  company: 'Société',
}

/** Formate une taille en octets en libellé lisible. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
