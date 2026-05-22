import type { FayaPayConfig } from './types'
import type { ApiErrorResponse } from './types/internal'
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

/** SDK version — injected in request headers */
const SDK_VERSION = '0.1.0'

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
  // [C1 FIX] ES2022 private fields — truly private at runtime.
  // Invisible via console.log, JSON.stringify, Object.keys, Reflect.ownKeys.
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #timeout: number

  /** Transaction operations: initiate, get, list */
  readonly transactions: Transactions
  /** Webhook signature verification */
  readonly webhooks: Webhooks

  constructor(config: FayaPayConfig) {
    // --- Validate apiKey ---
    if (!config.apiKey) {
      throw new FayaPayError(
        'apiKey is required. Get yours at https://dashboard.fayapay.app',
        'MISSING_API_KEY'
      )
    }

    // --- [M1 FIX] Validate baseUrl ---
    const baseUrl = (config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, '')
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseUrl)
    if (!isLocalhost && !baseUrl.startsWith('https://')) {
      throw new FayaPayError(
        `baseUrl must use HTTPS in production. Received: ${baseUrl}`,
        'INVALID_BASE_URL'
      )
    }

    // --- [M2 FIX] Validate timeout ---
    const timeout = config.timeout ?? DEFAULTS.timeout
    if (timeout <= 0 || !Number.isFinite(timeout)) {
      throw new FayaPayError(
        `timeout must be a positive number in milliseconds. Received: ${timeout}`,
        'INVALID_TIMEOUT'
      )
    }

    this.#apiKey = config.apiKey
    this.#baseUrl = baseUrl
    this.#timeout = timeout

    // Bind the request method and inject into resources
    const boundRequest: RequestFn = this.#request.bind(this)
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
  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: { body?: unknown; query?: Record<string, string> }
  ): Promise<T> {
    // Build URL with query params
    let url = `${this.#baseUrl}${path}`
    if (options?.query && Object.keys(options.query).length > 0) {
      const searchParams = new URLSearchParams(options.query)
      url += `?${searchParams.toString()}`
    }

    // [C2 FIX] AbortController stays active until ALL async work is done
    // (including body reading), not just the initial fetch.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.#timeout)

    try {
      // [H3 FIX] Only set Content-Type when there's a body
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.#apiKey}`,
        'Accept': 'application/json',
        'X-FayaPay-SDK': `node/${SDK_VERSION}`,
      }
      if (options?.body) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      // Success path
      if (response.ok) {
        // [H2 FIX] Catch JSON parse errors separately from network errors
        let json: { data: T }
        try {
          json = (await response.json()) as { data: T }
        } catch {
          throw new FayaPayError(
            `API returned status ${response.status} but response body is not valid JSON`,
            'INVALID_RESPONSE',
            response.status
          )
        }
        return json.data
      }

      // Error path — parse error body and throw typed error
      const errorBody = await this.#parseErrorBody(response)
      throw this.#mapHttpError(response.status, errorBody)
    } catch (error) {
      // Re-throw SDK errors as-is
      if (error instanceof FayaPayError) {
        throw error
      }

      // [H4 FIX] Check error.name only — DOMException instanceof is fragile
      // across Node.js versions, Bun, and other runtimes
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FayaPayNetworkError(
          `Request timed out after ${this.#timeout}ms`
        )
      }

      // Generic network failure
      throw new FayaPayNetworkError(
        error instanceof Error
          ? `Network error: ${error.message}`
          : 'An unknown network error occurred'
      )
    } finally {
      // [C2 FIX] clearTimeout in finally — guarantees cleanup after body read
      clearTimeout(timeoutId)
    }
  }

  /**
   * Safely parse the error response body.
   * Returns a structured error or a fallback if parsing fails.
   */
  async #parseErrorBody(response: Response): Promise<ApiErrorResponse> {
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
  #mapHttpError(
    status: number,
    body: ApiErrorResponse
  ): FayaPayError {
    // [H1 FIX] Defensive access — API may return any JSON shape
    const message = body?.error?.message ?? `Request failed with status ${status}`

    switch (status) {
      case 401:
        return new FayaPayAuthError(message)

      case 404:
        return new FayaPayNotFoundError(message)

      case 409:
        return new FayaPayDuplicateError(
          message,
          body?.error?.existing_transaction
        )

      case 422:
        return new FayaPayValidationError(message, body?.error?.fields)

      case 503:
        return new FayaPayGatewayUnavailableError(message)

      default:
        return new FayaPayError(message, body?.error?.code ?? 'UNKNOWN', status)
    }
  }

  /**
   * Custom inspect — prevents apiKey from leaking in console.log / util.inspect.
   * [C1 FIX]
   */
  [Symbol.for('nodejs.util.inspect.custom')](): object {
    return {
      baseUrl: this.#baseUrl,
      timeout: this.#timeout,
      transactions: this.transactions,
      webhooks: this.webhooks,
    }
  }
}
