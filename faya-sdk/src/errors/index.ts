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

  /**
   * [M5 FIX] Ensures JSON.stringify(error) produces useful output.
   * By default, Error properties are non-enumerable → JSON.stringify returns {}.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    }
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

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      fields: this.fields,
    }
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
 * [M3 FIX] Redact phone_number from existingTransaction to prevent
 * accidental PII leaks in logs (Sentry, Datadog, ELK, etc.).
 */
function redactTransaction(tx?: Transaction): Transaction | undefined {
  if (!tx) return undefined
  return {
    ...tx,
    phone_number: tx.phone_number
      ? `${tx.phone_number.slice(0, 6)}****${tx.phone_number.slice(-2)}`
      : '',
  }
}

/**
 * Thrown when a transaction with the same reference already exists.
 * HTTP 409. Exposes the existing transaction for idempotent handling.
 *
 * Note: `phone_number` is redacted in `existingTransaction` to prevent
 * accidental PII leaks in log aggregators.
 */
export class FayaPayDuplicateError extends FayaPayError {
  /** The existing transaction that already uses this reference (phone redacted) */
  readonly existingTransaction?: Transaction

  constructor(message: string, existingTransaction?: Transaction) {
    super(message, 'DUPLICATE_REFERENCE', 409)
    this.name = 'FayaPayDuplicateError'
    this.existingTransaction = redactTransaction(existingTransaction)
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      existingTransaction: this.existingTransaction,
    }
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
