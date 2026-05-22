import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import FayaPay from '../src/client'
import {
  FayaPayAuthError,
  FayaPayError,
  FayaPayNetworkError,
  FayaPayNotFoundError,
  FayaPayValidationError,
  FayaPayGatewayUnavailableError,
  FayaPayDuplicateError,
} from '../src/errors'

/** Helper to create a mock Response */
function mockResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: `Status ${status}`,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as Response
}

/** Standard error body factory */
function errorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return {
    success: false,
    error: { code, message, ...extra },
  }
}

describe('FayaPay Client', () => {
  let client: FayaPay
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new FayaPay({
      apiKey: 'faya_test_xxxxxxxxxxxxxxxxxxxx',
      baseUrl: 'https://api.test.fayapay.app',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ─── Constructor ────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new FayaPay({ apiKey: '' })).toThrow(FayaPayError)
    })

    it('strips trailing slashes from baseUrl', async () => {
      const c = new FayaPay({
        apiKey: 'faya_test_key',
        baseUrl: 'https://api.test.com///',
      })

      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { id: '1' } })
      )

      await c.transactions.get('1')

      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        'https://api.test.com/v1/transactions/1',
        expect.any(Object)
      )
    })
  })

  // ─── HTTP error mapping ─────────────────────────────────────────

  describe('error mapping', () => {
    it('maps 401 to FayaPayAuthError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(401, errorBody('UNAUTHORIZED', 'Invalid API key'))
      )

      await expect(client.transactions.get('id')).rejects.toThrow(FayaPayAuthError)
    })

    it('maps 404 to FayaPayNotFoundError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(404, errorBody('NOT_FOUND', 'Transaction not found'))
      )

      await expect(client.transactions.get('missing')).rejects.toThrow(
        FayaPayNotFoundError
      )
    })

    it('maps 409 to FayaPayDuplicateError with existingTransaction', async () => {
      const existingTx = { id: 'existing-tx', reference: 'order_1', status: 'SUCCESS' }
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(
          409,
          errorBody('DUPLICATE_REFERENCE', 'Reference already used', {
            existing_transaction: existingTx,
          })
        )
      )

      try {
        await client.transactions.initiate({
          reference: 'order_1',
          amount: 5000,
          currency: 'XAF',
          operator: 'AIRTEL',
          phone_number: '+23566000000',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayDuplicateError)
        expect((error as FayaPayDuplicateError).existingTransaction).toEqual(existingTx)
      }
    })

    it('maps 422 to FayaPayValidationError with fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(
          422,
          errorBody('VALIDATION_ERROR', 'Invalid params', {
            fields: { amount: 'must be positive', phone_number: 'invalid format' },
          })
        )
      )

      try {
        await client.transactions.initiate({
          reference: 'order_bad',
          amount: -1,
          currency: 'XAF',
          operator: 'AIRTEL',
          phone_number: 'not-a-phone',
        })
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayValidationError)
        expect((error as FayaPayValidationError).fields).toEqual({
          amount: 'must be positive',
          phone_number: 'invalid format',
        })
      }
    })

    it('maps 503 to FayaPayGatewayUnavailableError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(503, errorBody('GATEWAY_UNAVAILABLE', 'Gateway offline'))
      )

      await expect(
        client.transactions.initiate({
          reference: 'order_gw',
          amount: 1000,
          currency: 'XAF',
          operator: 'MOOV',
          phone_number: '+23566000000',
        })
      ).rejects.toThrow(FayaPayGatewayUnavailableError)
    })

    it('maps unknown status codes to generic FayaPayError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(500, errorBody('INTERNAL_ERROR', 'Something broke'))
      )

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayError)
        expect((error as FayaPayError).code).toBe('INTERNAL_ERROR')
        expect((error as FayaPayError).statusCode).toBe(500)
      }
    })

    it('handles unparseable error body gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('not JSON')),
        headers: new Headers(),
      } as Response)

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayError)
        expect((error as FayaPayError).code).toBe('UNKNOWN')
      }
    })
  })

  // ─── Timeout ────────────────────────────────────────────────────

  describe('timeout', () => {
    it('throws FayaPayNetworkError when request times out', async () => {
      const slowClient = new FayaPay({
        apiKey: 'faya_test_key',
        baseUrl: 'https://api.test.com',
        timeout: 50, // 50ms
      })

      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, options: RequestInit) => {
          return new Promise((_resolve, reject) => {
            const signal = options.signal!
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'))
            })
          })
        }
      )

      await expect(slowClient.transactions.get('id')).rejects.toThrow(
        FayaPayNetworkError
      )
    }, 10_000)
  })

  // ─── Network failure ────────────────────────────────────────────

  describe('network failure', () => {
    it('throws FayaPayNetworkError on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new TypeError('fetch failed')
      )

      await expect(client.transactions.get('id')).rejects.toThrow(
        FayaPayNetworkError
      )
    })

    it('includes original error message in FayaPayNetworkError', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new TypeError('getaddrinfo ENOTFOUND api.test.fayapay.app')
      )

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayNetworkError)
        expect((error as FayaPayNetworkError).message).toContain('ENOTFOUND')
      }
    })
  })

  // ─── Request headers ───────────────────────────────────────────

  describe('request headers', () => {
    it('sends correct Authorization and Content-Type headers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { id: '1' } })
      )

      await client.transactions.get('1')

      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer faya_test_xxxxxxxxxxxxxxxxxxxx',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      )
    })
  })
})
