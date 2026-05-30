// =============================================================================
// Kadryza Dashboard — Types TypeScript
// =============================================================================

// -----------------------------------------------------------------------------
// Enums & Union Types
// -----------------------------------------------------------------------------

/** Statuts possibles d'une transaction */
export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'WAITING_SMS'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'REFUNDED'

/** Opérateurs mobile money supportés */
export type OperatorType = 'AIRTEL' | 'MOOV'

// -----------------------------------------------------------------------------
// Entités principales
// -----------------------------------------------------------------------------

/** Transaction de paiement mobile money */
export interface Transaction {
  id: string
  reference: string
  internal_ref: string
  amount: number              // En entiers XAF — jamais de float
  currency: 'XAF'
  operator: OperatorType
  phone_number: string
  description?: string
  status: TransactionStatus
  failure_reason?: string
  webhook_sent: boolean
  initiated_at: string        // ISO 8601
  confirmed_at?: string
  expires_at: string
  created_at: string
}

/** Merchant (propriétaire de compte business) */
export interface Merchant {
  id: string
  name: string
  email: string
  email_verified: boolean
  is_active: boolean
  created_at: string
}

/** Clé API pour l'intégration */
export interface ApiKey {
  id: string
  prefix: string              // "kadryza_live_xxxx" — affiché tronqué
  created_at: string
  /** La clé complète n'est retournée qu'à la création — une seule fois */
  full_key?: string
}

/** Endpoint webhook configuré par le merchant */
export interface WebhookEndpoint {
  id: string
  url: string
  is_active: boolean
  created_at: string
  /** Le secret n'est retourné qu'à la création — une seule fois */
  secret?: string
}

/** Lien de paiement (hosted checkout) */
export interface PaymentLink {
  id: string
  slug: string
  amount: number              // En entiers XAF
  currency: string
  description?: string
  is_active: boolean
  is_reusable: boolean
  success_url?: string
  paid_count: number
  expires_at?: string         // ISO 8601
  url: string                 // URL publique de checkout
  created_at: string
}

/** Payload de création d'un lien de paiement */
export interface CreatePaymentLinkRequest {
  amount: number
  description?: string
  is_reusable?: boolean
  success_url?: string
  expires_at?: string
}

/** Réponse paginée des liens de paiement */
export interface PaymentLinkListResponse {
  payment_links: PaymentLink[]
  total: number
  limit: number
  offset: number
}

/** Vue publique d'un lien de paiement (page checkout) */
export interface CheckoutView {
  slug: string
  amount: number
  currency: string
  description?: string
  merchant_name: string
  is_payable: boolean
}

/** Statut public d'une transaction de checkout (polling) */
export interface CheckoutTransactionStatus {
  id: string
  status: TransactionStatus
  amount: number
  failure_reason?: string
}

/** Réponse à l'initiation d'un paiement de checkout */
export interface CheckoutPayResponse {
  id: string
  internal_ref: string
  status: TransactionStatus
  expires_at: string
}

// -----------------------------------------------------------------------------
// Métriques & Dashboard
// -----------------------------------------------------------------------------

/** Données d'un jour pour le graphique de volume */
export interface DayMetric {
  date: string                // Format "YYYY-MM-DD"
  volume: number              // Volume total en XAF
  count: number               // Nombre de transactions
}

/** Répartition par opérateur */
export interface OperatorMetric {
  operator: OperatorType
  count: number
  volume: number
}

/** Statistiques globales du dashboard overview */
export interface DashboardStats {
  total_volume: number
  total_transactions: number
  success_rate: number        // Pourcentage (0-100)
  transactions_by_day: DayMetric[]
  by_operator: OperatorMetric[]
}

// -----------------------------------------------------------------------------
// Solde & Settlements (Chapitre 2)
// -----------------------------------------------------------------------------

/** Aperçu du solde du marchand (montants en entiers XAF) */
export interface Balance {
  available: number
  reserved: number
  total_volume: number
  total_fees: number
  total_settled: number
  payment_count: number
  currency: string
  fee_bps: number
}

/** Statut d'un settlement (reversement) */
export type SettlementStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

/** Reversement (payout) */
export interface Settlement {
  id: string
  amount: number
  currency: string
  status: SettlementStatus
  method: string              // AIRTEL | MOOV | BANK
  destination: string
  failure_reason?: string
  requested_at: string
  completed_at?: string
  created_at: string
}

/** Payload de demande de retrait */
export interface CreateSettlementRequest {
  amount: number
  method: string
  destination: string
}

/** Réponse paginée des settlements */
export interface SettlementListResponse {
  settlements: Settlement[]
  total: number
  limit: number
  offset: number
}

// -----------------------------------------------------------------------------
// Réponses API
// -----------------------------------------------------------------------------

/** Réponse paginée générique */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

/** Erreur API standardisée */
export interface ApiError {
  error: string
  code: string
}

// -----------------------------------------------------------------------------
// Requêtes (payloads envoyés à l'API)
// -----------------------------------------------------------------------------

/** Payload de connexion */
export interface LoginRequest {
  email: string
  password: string
}

/** Payload d'inscription */
export interface RegisterRequest {
  name: string
  email: string
  password: string
  password_confirmation: string
}

/** Réponse d'authentification */
export interface AuthResponse {
  token: string
  expires_at: string   // ISO 8601 — date d'expiration du JWT
  merchant: Merchant
}

/** Payload de création de webhook */
export interface CreateWebhookRequest {
  url: string
}

/** Résultat du test d'un webhook */
export interface WebhookTestResult {
  success: boolean
  status_code?: number
  response_time_ms?: number
  error?: string
}

// -----------------------------------------------------------------------------
// Filtres & Paramètres de requête
// -----------------------------------------------------------------------------

/** Filtres pour la liste des transactions */
export interface TransactionFilters {
  status?: TransactionStatus
  operator?: OperatorType
  date_from?: string          // ISO 8601
  date_to?: string            // ISO 8601
  search?: string             // Recherche par référence
  page?: number
  per_page?: number
}

/** Période prédéfinie pour les filtres */
export type DatePreset = 'today' | '7d' | '30d' | 'custom'

// -----------------------------------------------------------------------------
// État de la gateway
// -----------------------------------------------------------------------------

/** Statut de connexion d'un opérateur */
export interface OperatorStatus {
  operator: OperatorType
  is_connected: boolean
  last_check: string          // ISO 8601
}

/** Statut global de la gateway */
export interface GatewayStatus {
  is_connected: boolean
  operators: OperatorStatus[]
}

// -----------------------------------------------------------------------------
// Utilitaires UI
// -----------------------------------------------------------------------------

/** Item de navigation dans la sidebar */
export interface NavItem {
  label: string
  href: string
  icon: string                // Nom de l'icône Lucide
  badge?: number              // Compteur optionnel
}

/** Props communes pour les composants avec état de chargement */
export interface LoadableProps {
  isLoading?: boolean
  error?: string | null
}
