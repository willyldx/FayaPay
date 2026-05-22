import type { TransactionStatus, OperatorType } from '@/lib/types'

// =============================================================================
// Formatage des montants
// =============================================================================

/**
 * Formate un montant entier en XAF avec séparateur d'espaces.
 * formatAmount(12450000) → "12 450 000 XAF"
 * formatAmount(5000)     → "5 000 XAF"
 * formatAmount(0)        → "0 XAF"
 */
export function formatAmount(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} XAF`
}

/**
 * Formate un montant sans le suffixe XAF (pour les graphiques).
 * formatAmountShort(12450000) → "12 450 000"
 */
export function formatAmountShort(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount)
}

/**
 * Formate un montant en version compacte (pour les cartes métriques).
 * formatAmountCompact(12450000) → "12,5M XAF"
 * formatAmountCompact(450000)   → "450K XAF"
 * formatAmountCompact(5000)     → "5 000 XAF"
 */
export function formatAmountCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions.toFixed(1).replace('.', ',')
    return `${formatted}M XAF`
  }
  if (amount >= 100_000) {
    const thousands = Math.round(amount / 1_000)
    return `${thousands}K XAF`
  }
  return formatAmount(amount)
}

// =============================================================================
// Formatage des dates
// =============================================================================

/**
 * Formate une date ISO 8601 en format lisible français.
 * formatDate("2024-01-15T10:00:00Z") → "15 jan. 2024, 10:00"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formate une date ISO 8601 en format court (pour les tableaux).
 * formatDateShort("2024-01-15T10:00:00Z") → "15/01/2024"
 */
export function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formate une date en format relatif (pour "il y a X minutes").
 * formatDateRelative("...") → "il y a 5 min" | "il y a 2h" | "il y a 3j"
 */
export function formatDateRelative(isoDate: string): string {
  const now = Date.now()
  const date = new Date(isoDate).getTime()
  const diffMs = now - date

  // [L-4 FIX] Gérer les dates futures (ex: expires_at)
  if (diffMs < 0) {
    const futMs = -diffMs
    const futMin = Math.floor(futMs / 60_000)
    const futH = Math.floor(futMs / 3_600_000)
    const futD = Math.floor(futMs / 86_400_000)
    if (futMin < 1) return 'dans quelques secondes'
    if (futMin < 60) return `dans ${futMin} min`
    if (futH < 24) return `dans ${futH}h`
    if (futD < 30) return `dans ${futD}j`
    return formatDateShort(isoDate)
  }

  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD < 30) return `il y a ${diffD}j`
  return formatDateShort(isoDate)
}

// =============================================================================
// Formatage des numéros de téléphone
// =============================================================================

/**
 * Formate un numéro tchadien en format lisible.
 * formatPhone("+23566000000") → "+235 66 00 00 00"
 * formatPhone("66000000")    → "66 00 00 00"
 */
export function formatPhone(phone: string): string {
  // Nettoyage : garder uniquement chiffres et +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Format avec indicatif pays (+235)
  if (cleaned.startsWith('+235') && cleaned.length === 12) {
    const local = cleaned.slice(4) // 8 chiffres
    return `+235 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`
  }

  // Format local (8 chiffres)
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`
  }

  // Fallback : retourner tel quel
  return phone
}

// =============================================================================
// Statuts de transaction — couleurs & labels
// =============================================================================

/** Mapping statut → classes Tailwind (bg + text) pour les badges */
const STATUS_COLORS: Record<TransactionStatus, string> = {
  PENDING:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESSING:  'bg-blue-100 text-blue-800 border-blue-200',
  WAITING_SMS: 'bg-purple-100 text-purple-800 border-purple-200',
  SUCCESS:     'bg-green-100 text-green-800 border-green-200',
  FAILED:      'bg-red-100 text-red-800 border-red-200',
  TIMEOUT:     'bg-gray-100 text-gray-800 border-gray-200',
  REFUNDED:    'bg-orange-100 text-orange-800 border-orange-200',
}

/** Mapping statut → couleur Tailwind pour les points/indicateurs */
const STATUS_DOT_COLORS: Record<TransactionStatus, string> = {
  PENDING:     'bg-yellow-500',
  PROCESSING:  'bg-blue-500',
  WAITING_SMS: 'bg-purple-500',
  SUCCESS:     'bg-green-500',
  FAILED:      'bg-red-500',
  TIMEOUT:     'bg-gray-500',
  REFUNDED:    'bg-orange-500',
}

/** Mapping statut → label en français */
const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING:     'En attente',
  PROCESSING:  'En cours',
  WAITING_SMS: 'Attente SMS',
  SUCCESS:     'Réussi',
  FAILED:      'Échoué',
  TIMEOUT:     'Expiré',
  REFUNDED:    'Remboursé',
}

/**
 * Retourne les classes Tailwind CSS pour un badge de statut.
 * getStatusColor('SUCCESS') → "bg-green-100 text-green-800 border-green-200"
 */
export function getStatusColor(status: TransactionStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.PENDING
}

/**
 * Retourne la classe de couleur du point indicateur.
 * getStatusDotColor('SUCCESS') → "bg-green-500"
 */
export function getStatusDotColor(status: TransactionStatus): string {
  return STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.PENDING
}

/**
 * Retourne le label en français pour un statut de transaction.
 * getStatusLabel('WAITING_SMS') → "Attente SMS"
 */
export function getStatusLabel(status: TransactionStatus): string {
  return STATUS_LABELS[status] ?? status
}

// =============================================================================
// Opérateurs — couleurs
// =============================================================================

/** Mapping opérateur → classes Tailwind pour les badges */
const OPERATOR_COLORS: Record<OperatorType, string> = {
  AIRTEL: 'bg-red-100 text-red-800 border-red-200',
  MOOV:   'bg-blue-100 text-blue-800 border-blue-200',
}

/** Mapping opérateur → couleur hex pour les graphiques (Tremor) */
const OPERATOR_CHART_COLORS: Record<OperatorType, string> = {
  AIRTEL: '#EF4444',
  MOOV:   '#3B82F6',
}

/**
 * Retourne les classes Tailwind pour un badge opérateur.
 * getOperatorColor('AIRTEL') → "bg-red-100 text-red-800 border-red-200"
 */
export function getOperatorColor(operator: OperatorType): string {
  return OPERATOR_COLORS[operator] ?? ''
}

/**
 * Retourne la couleur hex pour les graphiques Tremor.
 * getOperatorChartColor('MOOV') → "#3B82F6"
 */
export function getOperatorChartColor(operator: OperatorType): string {
  return OPERATOR_CHART_COLORS[operator] ?? '#6B7280'
}

// =============================================================================
// Pourcentage
// =============================================================================

/**
 * Formate un pourcentage.
 * formatPercent(94.7) → "94,7%"
 * formatPercent(100)  → "100%"
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`.replace(',0%', '%')
}
