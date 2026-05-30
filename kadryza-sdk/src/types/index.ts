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

export interface KadryzaConfig {
  /** API key provided by Kadryza dashboard (kadryza_live_xxx or kadryza_test_xxx) */
  apiKey: string
  /** Base URL of the Kadryza API. Defaults to https://api.kadryza.app */
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
  /** Kadryza internal reference */
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
  /** Max number of transactions to return (default 20) */
  limit?: number
  /** Number of transactions to skip — for pagination (default 0) */
  offset?: number
  /** Filter by transaction status */
  status?: TransactionStatus
}

export interface PaginatedTransactions {
  /** Transactions for this page */
  transactions: Transaction[]
  /** Total number of matching transactions */
  total: number
  /** The `limit` that was applied */
  limit: number
  /** The `offset` that was applied */
  offset: number
}

// ─── Webhooks ───────────────────────────────────────────────────────

export type WebhookEventType =
  | 'transaction.success'
  | 'transaction.failed'
  | 'transaction.timeout'
  | 'transaction.test'

/** Subset of Transaction fields actually sent in webhook payloads by the backend */
export interface WebhookEventData {
  /** UUID of the transaction */
  id: string
  /** Your merchant reference */
  reference: string
  /** Amount in the smallest currency unit */
  amount: number
  /** Currency code */
  currency: CurrencyType
  /** Mobile money operator used */
  operator: OperatorType
  /** Payer's phone number */
  phone_number: string
  /** Current status of the transaction */
  status: TransactionStatus
  /** ISO 8601 timestamp — when the transaction was confirmed */
  confirmed_at?: string
}

export interface WebhookPayload {
  /** The event type that triggered the webhook */
  event: WebhookEventType
  /** The transaction data associated with the event */
  data: WebhookEventData
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string
}

export interface VerifyWebhookParams {
  /** Raw request body as a string */
  payload: string
  /** Value of the x-kadryza-signature header */
  signature: string | undefined
  /** Your webhook secret from the Kadryza dashboard */
  secret: string
}

// ─── Webhook endpoint management ─────────────────────────────────────

export interface CreateWebhookParams {
  /** HTTPS URL that will receive webhook POST requests */
  url: string
}

/** A registered webhook endpoint (secret is never returned after creation). */
export interface WebhookEndpoint {
  /** UUID of the endpoint */
  id: string
  /** Destination URL */
  url: string
  /** Whether the endpoint is active */
  is_active: boolean
  /** ISO 8601 creation timestamp */
  created_at: string
}

/**
 * Returned once when creating an endpoint. The `secret` is shown ONLY here —
 * store it securely; it cannot be retrieved again.
 */
export interface CreatedWebhookEndpoint extends WebhookEndpoint {
  /** HMAC signing secret — shown only at creation. Use it with `webhooks.verify`. */
  secret: string
}

/** Result of triggering a test delivery. */
export interface WebhookTestResult {
  status: string
  message: string
}

