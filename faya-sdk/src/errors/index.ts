import type { Transaction } from '../types'

// ─── Base error ─────────────────────────────────────────────────────

/**
 * Base error class for all FayaPay SDK errors.
 * Merchants can catch this to handle any SDK error generically.
 *
 * @example
 * ```ts
 * try {
 *   await faya.transactions.initiate({...})
 * } catch (error) {
 *   if (error instanceof FayaPayError) {
 *     console.log(error.code, error.statusCode)
 *   }
 * }
 * ```
 */
export class FayaPayError extends Error {
  /** Machine-readable error code */
  readonly code: string
  /** HTTP status code from the API, if applicable */
  readonly statusCode?: number

  constructor(message: string, code: string, statusCode?: number) {
    super(message)
    this.name = 'FayaPayError'
    this.code = code
    this.statusCode = statusCode

    // Restore prototype chain (required for instanceof to work with TS targets < ES2015)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Authentication ─────────────────────────────────────────────────

/**
 * Thrown when the API key is invalid, expired, or missing.
 * HTTP 401.
 */
export class FayaPayAuthError extends FayaPayError {
  constructor(message = 'Invalid or expired API key') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'FayaPayAuthError'
  }
}

// ─── Validation ─────────────────────────────────────────────────────

/**
 * Thrown when request parameters fail validation.
 * HTTP 400 / 422.
 */
export class FayaPayValidationError extends FayaPayError {
  /** Map of field names to validation error messages */
  readonly fields?: Record<string, string>

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 422)
    this.name = 'FayaPayValidationError'
    this.fields = fields
  }
}

// ─── Not Found ──────────────────────────────────────────────────────

/**
 * Thrown when a transaction or resource is not found.
 * HTTP 404.
 */
export class FayaPayNotFoundError extends FayaPayError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404)
    this.name = 'FayaPayNotFoundError'
  }
}

// ─── Duplicate Reference ────────────────────────────────────────────

/**
 * Thrown when a transaction with the same reference already exists.
 * HTTP 409. Exposes the existing transaction for idempotent handling.
 */
export class FayaPayDuplicateError extends FayaPayError {
  /** The existing transaction that already uses this reference */
  readonly existingTransaction?: Transaction

  constructor(message: string, existingTransaction?: Transaction) {
    super(message, 'DUPLICATE_REFERENCE', 409)
    this.name = 'FayaPayDuplicateError'
    this.existingTransaction = existingTransaction
  }
}

// ─── Network / Timeout ──────────────────────────────────────────────

/**
 * Thrown when a network error or request timeout occurs.
 * No HTTP status code (request never reached the server).
 */
export class FayaPayNetworkError extends FayaPayError {
  constructor(message = 'Network error or request timed out') {
    super(message, 'NETWORK_ERROR')
    this.name = 'FayaPayNetworkError'
  }
}

// ─── Gateway Unavailable ────────────────────────────────────────────

/**
 * Thrown when the FayaPay Android gateway is disconnected.
 * HTTP 503.
 */
export class FayaPayGatewayUnavailableError extends FayaPayError {
  constructor(message = 'Payment gateway is currently unavailable') {
    super(message, 'GATEWAY_UNAVAILABLE', 503)
    this.name = 'FayaPayGatewayUnavailableError'
  }
}
