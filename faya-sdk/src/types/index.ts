// ─── Enums as union types ────────────────────────────────────────────

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'WAITING_SMS'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'REFUNDED'

export type OperatorType = 'AIRTEL' | 'MOOV'

export type CurrencyType = 'XAF'

// ─── SDK Configuration ──────────────────────────────────────────────

export interface FayaPayConfig {
  /** API key provided by FayaPay dashboard (faya_live_xxx or faya_test_xxx) */
  apiKey: string
  /** Base URL of the FayaPay API. Defaults to https://api.fayapay.app */
  baseUrl?: string
  /** Request timeout in milliseconds. Defaults to 30000 (30s) */
  timeout?: number
}

// ─── Transaction ────────────────────────────────────────────────────

export interface InitiateTransactionRequest {
  /** Your unique order/payment reference */
  reference: string
  /** Amount in XAF (integer, no decimals) */
  amount: number
  /** Currency code */
  currency: CurrencyType
  /** Mobile money operator */
  operator: OperatorType
  /** Payer's phone number in international format (+235...) */
  phone_number: string
  /** Optional human-readable description */
  description?: string
}

export interface Transaction {
  /** UUID of the transaction */
  id: string
  /** Your merchant reference */
  reference: string
  /** FayaPay internal reference */
  internal_ref: string
  /** Amount in the smallest currency unit */
  amount: number
  /** Currency code */
  currency: CurrencyType
  /** Mobile money operator used */
  operator: OperatorType
  /** Payer's phone number */
  phone_number: string
  /** Optional description */
  description?: string
  /** Current status of the transaction */
  status: TransactionStatus
  /** Reason for failure, if applicable */
  failure_reason?: string
  /** Whether the webhook notification was sent */
  webhook_sent: boolean
  /** ISO 8601 timestamp — when the transaction was initiated */
  initiated_at: string
  /** ISO 8601 timestamp — when the transaction was confirmed */
  confirmed_at?: string
  /** ISO 8601 timestamp — when the transaction expires */
  expires_at: string
  /** ISO 8601 timestamp — creation time */
  created_at: string
}

// ─── Pagination ─────────────────────────────────────────────────────

export interface TransactionListParams {
  /** Page number (1-indexed) */
  page?: number
  /** Number of items per page */
  per_page?: number
  /** Filter by transaction status */
  status?: TransactionStatus
  /** Filter by operator */
  operator?: OperatorType
  /** Filter start date (ISO 8601 or YYYY-MM-DD) */
  from?: string
  /** Filter end date (ISO 8601 or YYYY-MM-DD) */
  to?: string
}

export interface PaginatedTransactions {
  /** Array of transactions for the current page */
  data: Transaction[]
  /** Total number of matching transactions */
  total: number
  /** Current page number */
  page: number
  /** Items per page */
  per_page: number
}

// ─── Webhooks ───────────────────────────────────────────────────────

export type WebhookEventType =
  | 'transaction.success'
  | 'transaction.failed'
  | 'transaction.timeout'

export interface WebhookPayload {
  /** The event type that triggered the webhook */
  event: WebhookEventType
  /** The transaction data associated with the event */
  data: Transaction
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string
}

export interface VerifyWebhookParams {
  /** Raw request body as a string */
  payload: string
  /** Value of the x-faya-signature header */
  signature: string | undefined
  /** Your webhook secret from the FayaPay dashboard */
  secret: string
}

