// ─── Default export: main client class ──────────────────────────────
export { default } from './client'

// ─── Named exports: types ───────────────────────────────────────────
export type {
  FayaPayConfig,
  Transaction,
  TransactionStatus,
  OperatorType,
  CurrencyType,
  InitiateTransactionRequest,
  TransactionListParams,
  PaginatedTransactions,
  WebhookPayload,
  WebhookEventType,
  VerifyWebhookParams,
} from './types'

// ─── Named exports: error classes ───────────────────────────────────
export {
  FayaPayError,
  FayaPayAuthError,
  FayaPayValidationError,
  FayaPayNotFoundError,
  FayaPayDuplicateError,
  FayaPayNetworkError,
  FayaPayGatewayUnavailableError,
} from './errors'

// ─── Named exports: utilities ───────────────────────────────────────
export { verifyWebhookSignature } from './utils/signature'
