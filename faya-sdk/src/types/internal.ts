import type { Transaction } from '../types'

/**
 * @internal — SDK internal types. Not exported to merchants.
 */

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    fields?: Record<string, string>
    existing_transaction?: Transaction
  }
}
