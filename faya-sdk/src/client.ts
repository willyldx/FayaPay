import type {
  FayaPayConfig,
  ApiErrorResponse,
} from './types'
import {
  FayaPayError,
  FayaPayAuthError,
  FayaPayValidationError,
  FayaPayNotFoundError,
  FayaPayDuplicateError,
  FayaPayNetworkError,
  FayaPayGatewayUnavailableError,
} from './errors'
import { Transactions } from './resources/transactions'
import { Webhooks } from './resources/webhooks'

/** Default configuration values */
const DEFAULTS = {
  baseUrl: 'https://api.fayapay.app',
  timeout: 30_000,
} as const

/** Signature for the internal request function injected into resources */
export type RequestFn = <T>(
  method: 'GET' | 'POST',
  path: string,
  options?: { body?: unknown; query?: Record<string, string> }
) => Promise<T>

/**
 * FayaPay SDK client.
 *
 * @example
 * ```ts
 * import FayaPay from '@fayapay/sdk'
 *
 * const faya = new FayaPay({
 *   apiKey: 'faya_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * })
 *
 * const tx = await faya.transactions.initiate({
 *   reference: 'order_123',
 *   amount: 5000,
 *   currency: 'XAF',
 *   operator: 'AIRTEL',
 *   phone_number: '+23566000000',
 * })
 * ```
 */
export default class FayaPay {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeout: number

  /** Transaction operations: initiate, get, list */
  readonly transactions: Transactions
  /** Webhook signature verification */
  readonly webhooks: Webhooks

  constructor(config: FayaPayConfig) {
    if (!config.apiKey) {
      throw new FayaPayError(
        'apiKey is required. Get yours at https://dashboard.fayapay.app',
        'MISSING_API_KEY'
      )
    }

    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, '')
    this.timeout = config.timeout ?? DEFAULTS.timeout

    // Bind the request method and inject into resources
    const boundRequest: RequestFn = this.request.bind(this)
    this.transactions = new Transactions(boundRequest)
    this.webhooks = new Webhooks()
  }

  /**
   * Internal HTTP request method.
   * Handles authentication, timeout via AbortController, JSON parsing,
   * and mapping HTTP errors to typed SDK error classes.
   *
   * @internal
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: { body?: unknown; query?: Record<string, string> }
  ): Promise<T> {
    // Build URL with query params
    let url = `${this.baseUrl}${path}`
    if (options?.query && Object.keys(options.query).length > 0) {
      const searchParams = new URLSearchParams(options.query)
      url += `?${searchParams.toString()}`
    }

    // Timeout via AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': '@fayapay/sdk',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Success path
      if (response.ok) {
        const json = (await response.json()) as { data: T }
        return json.data
      }

      // Error path — parse error body and throw typed error
      const errorBody = await this.parseErrorBody(response)
      throw this.mapHttpError(response.status, errorBody)
    } catch (error) {
      clearTimeout(timeoutId)

      // Re-throw SDK errors as-is
      if (error instanceof FayaPayError) {
        throw error
      }

      // AbortController timeout or fetch failure
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new FayaPayNetworkError(
          `Request timed out after ${this.timeout}ms`
        )
      }

      // Generic network failure
      throw new FayaPayNetworkError(
        error instanceof Error
          ? `Network error: ${error.message}`
          : 'An unknown network error occurred'
      )
    }
  }

  /**
   * Safely parse the error response body.
   * Returns a structured error or a fallback if parsing fails.
   */
  private async parseErrorBody(response: Response): Promise<ApiErrorResponse> {
    try {
      return (await response.json()) as ApiErrorResponse
    } catch {
      return {
        success: false,
        error: {
          code: 'UNKNOWN',
          message: response.statusText || 'Unknown error',
        },
      }
    }
  }

  /**
   * Map an HTTP status code + error body to the appropriate SDK error class.
   */
  private mapHttpError(
    status: number,
    body: ApiErrorResponse
  ): FayaPayError {
    const message = body.error.message

    switch (status) {
      case 401:
        return new FayaPayAuthError(message)

      case 404:
        return new FayaPayNotFoundError(message)

      case 409:
        return new FayaPayDuplicateError(
          message,
          body.error.existing_transaction
        )

      case 422:
        return new FayaPayValidationError(message, body.error.fields)

      case 503:
        return new FayaPayGatewayUnavailableError(message)

      default:
        return new FayaPayError(message, body.error.code, status)
    }
  }
}
