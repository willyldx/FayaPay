// ─── Default export: main client class ──────────────────────────────
export { default } from './client'

// ─── Named exports: types ───────────────────────────────────────────
export type {
  KadryzaConfig,
  Transaction,
  TransactionStatus,
  OperatorType,
  CurrencyType,
  InitiateTransactionRequest,
  TransactionListParams,
  PaginatedTransactions,
  WebhookPayload,
  WebhookEventData,
  WebhookEventType,
  VerifyWebhookParams,
  CreateWebhookParams,
  WebhookEndpoint,
  CreatedWebhookEndpoint,
  WebhookTestResult,
} from './types'

// ─── Named exports: error classes ───────────────────────────────────
export {
  KadryzaError,
  KadryzaAuthError,
  KadryzaValidationError,
  KadryzaNotFoundError,
  KadryzaDuplicateError,
  KadryzaNetworkError,
  KadryzaGatewayUnavailableError,
} from './errors'

// ─── Named exports: utilities ───────────────────────────────────────
export { verifyWebhookSignature } from './utils/signature'
