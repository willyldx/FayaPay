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

    it('[C1] does not expose apiKey via console inspection', () => {
      const faya = new FayaPay({ apiKey: 'faya_live_supersecret' })
      const inspected = JSON.stringify(faya)
      expect(inspected).not.toContain('supersecret')
    })

    it('[M1] rejects non-HTTPS baseUrl', () => {
      expect(
        () => new FayaPay({ apiKey: 'faya_test_key', baseUrl: 'http://evil.com' })
      ).toThrow('baseUrl must use HTTPS')
    })

    it('[M1] allows http://localhost for development', () => {
      expect(
        () => new FayaPay({ apiKey: 'faya_test_key', baseUrl: 'http://localhost:8080' })
      ).not.toThrow()
    })

    it('[M2] rejects timeout <= 0', () => {
      expect(
        () => new FayaPay({ apiKey: 'faya_test_key', timeout: 0 })
      ).toThrow('timeout must be a positive number')
    })

    it('[M2] rejects negative timeout', () => {
      expect(
        () => new FayaPay({ apiKey: 'faya_test_key', timeout: -1 })
      ).toThrow('timeout must be a positive number')
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

    it('maps 409 to FayaPayDuplicateError with redacted phone', async () => {
      const existingTx = {
        id: 'existing-tx',
        reference: 'order_1',
        status: 'SUCCESS',
        phone_number: '+23566123456',
      }
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
        const dup = error as FayaPayDuplicateError
        // [M3] Phone should be redacted
        expect(dup.existingTransaction?.phone_number).not.toBe('+23566123456')
        expect(dup.existingTransaction?.phone_number).toContain('****')
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
          amount: 100,
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

    it('[H1] handles malformed error body without crashing', async () => {
      // API returns { "error": "string" } instead of { "error": { "message": "..." } }
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(500, { error: 'Internal Server Error' })
      )

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayError)
        expect((error as FayaPayError).message).toContain('500')
      }
    })

    it('[H1] handles error body with no error property', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(502, { message: 'Bad Gateway' })
      )

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayError)
        // Should not throw TypeError
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

  // ─── [H2] Success path non-JSON ─────────────────────────────────

  describe('success path', () => {
    it('[H2] throws INVALID_RESPONSE when 200 body is not JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        headers: new Headers(),
      } as unknown as Response)

      try {
        await client.transactions.get('id')
      } catch (error) {
        expect(error).toBeInstanceOf(FayaPayError)
        expect((error as FayaPayError).code).toBe('INVALID_RESPONSE')
        // Should NOT be FayaPayNetworkError
        expect(error).not.toBeInstanceOf(FayaPayNetworkError)
      }
    })
  })

  // ─── Timeout ────────────────────────────────────────────────────

  describe('timeout', () => {
    it('[C2] throws FayaPayNetworkError when request times out', async () => {
      const slowClient = new FayaPay({
        apiKey: 'faya_test_key',
        baseUrl: 'https://api.test.com',
        timeout: 50,
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

    it('[H4] detects AbortError without instanceof DOMException', async () => {
      const slowClient = new FayaPay({
        apiKey: 'faya_test_key',
        baseUrl: 'https://api.test.com',
        timeout: 50,
      })

      // Simulate Bun-style AbortError (plain Error, not DOMException)
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, options: RequestInit) => {
          return new Promise((_resolve, reject) => {
            const signal = options.signal!
            signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted')
              err.name = 'AbortError'
              reject(err)
            })
          })
        }
      )

      const error = await slowClient.transactions.get('id').catch((e: Error) => e)
      expect(error).toBeInstanceOf(FayaPayNetworkError)
      expect((error as FayaPayNetworkError).message).toContain('timed out')
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

  // ─── [H3] Request headers ──────────────────────────────────────

  describe('request headers', () => {
    it('sends Authorization and Accept headers', async () => {
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
            'Accept': 'application/json',
          }),
        })
      )
    })

    it('[H3] does NOT send Content-Type on GET requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { id: '1' } })
      )

      await client.transactions.get('1')

      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]!
      const headers = callArgs[1]?.headers as Record<string, string>
      expect(headers['Content-Type']).toBeUndefined()
    })

    it('[H3] sends Content-Type on POST requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { id: '1', status: 'PENDING' } })
      )

      await client.transactions.initiate({
        reference: 'order_1',
        amount: 5000,
        currency: 'XAF',
        operator: 'AIRTEL',
        phone_number: '+23566000000',
      })

      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]!
      const headers = callArgs[1]?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  // ─── [M5] Error serialization ──────────────────────────────────

  describe('error serialization', () => {
    it('[M5] JSON.stringify preserves code and statusCode', () => {
      const error = new FayaPayAuthError('Invalid key')
      const json = JSON.parse(JSON.stringify(error))

      expect(json.name).toBe('FayaPayAuthError')
      expect(json.message).toBe('Invalid key')
      expect(json.code).toBe('UNAUTHORIZED')
      expect(json.statusCode).toBe(401)
    })
  })
})
