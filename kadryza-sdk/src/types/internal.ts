import type { Transaction } from '../types'

/**
 * @internal — SDK internal types. Not exported to merchants.
 */

/**
 * Error body returned by the Kadryza API.
 *
 * The API returns a FLAT shape (not a `{ success, error: { ... } }` envelope):
 *   { "error": "human message", "code": "MACHINE_CODE", ... }
 *
 * Some endpoints add extra fields (e.g. `fields` for validation,
 * `existing_transaction` for duplicate references).
 */
export interface ApiErrorResponse {
  /** Human-readable error message */
  error?: string
  /** Machine-readable error code */
  code?: string
  /** Per-field validation messages (when code is a validation error) */
  fields?: Record<string, string>
  /** The conflicting transaction, returned on duplicate-reference (409) */
  existing_transaction?: Transaction
}
