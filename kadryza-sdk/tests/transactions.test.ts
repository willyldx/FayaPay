import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Transactions } from '../src/resources/transactions'
import {
  KadryzaDuplicateError,
  KadryzaGatewayUnavailableError,
  KadryzaNotFoundError,
  KadryzaValidationError,
} from '../src/errors'
import type { RequestFn } from '../src/client'
import type { Transaction, PaginatedTransactions } from '../src/types'

/** Factory for a realistic transaction object */
function mockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reference: 'order_123',
    internal_ref: 'KADRYZA-20240615-001',
    amount: 5000,
    currency: 'XAF',
    operator: 'AIRTEL',
    phone_number: '+23566000000',
    status: 'PENDING',
    webhook_sent: false,
    initiated_at: '2024-06-15T10:30:00Z',
    expires_at: '2024-06-15T10:35:00Z',
    created_at: '2024-06-15T10:30:00Z',
    ...overrides,
  }
}

describe('Transactions resource', () => {
  let mockRequest: ReturnType<typeof vi.fn>
  let transactions: Transactions

  beforeEach(() => {
    mockRequest = vi.fn()
    transactions = new Transactions(mockRequest as RequestFn)
  })

  // ─── initiate() ─────────────────────────────────────────────────

  describe('initiate()', () => {
    const params = {
      reference: 'order_123',
      amount: 5000,
      currency: 'XAF' as const,
      operator: 'AIRTEL' as const,
      phone_number: '+23566000000',
      description: 'Commande #123',
    }

    it('returns a Transaction on success', async () => {
      const expected = mockTransaction()
      mockRequest.mockResolvedValue(expected)

      const result = await transactions.initiate(params)

      expect(result).toEqual(expected)
      expect(mockRequest).toHaveBeenCalledWith('POST', '/v1/transactions', {
        body: params,
      })
    })

    it('throws KadryzaDuplicateError when reference already exists', async () => {
      const existing = mockTransaction({ status: 'SUCCESS' })
      mockRequest.mockRejectedValue(
        new KadryzaDuplicateError('Reference already used', existing)
      )

      await expect(transactions.initiate(params)).rejects.toThrow(
        KadryzaDuplicateError
      )

      try {
        await transactions.initiate(params)
      } catch (error) {
        expect(error).toBeInstanceOf(KadryzaDuplicateError)
        const dup = error as KadryzaDuplicateError
        expect(dup.code).toBe('DUPLICATE_REFERENCE')
        // [M3] phone_number is redacted in existingTransaction
        expect(dup.existingTransaction?.phone_number).toContain('****')
        expect(dup.existingTransaction?.id).toBe(existing.id)
      }
    })

    it('throws KadryzaGatewayUnavailableError when gateway is offline', async () => {
      mockRequest.mockRejectedValue(
        new KadryzaGatewayUnavailableError()
      )

      await expect(transactions.initiate(params)).rejects.toThrow(
        KadryzaGatewayUnavailableError
      )
    })

    // ─── [M4] Amount validation ──────────────────────────────────

    it('[M4] throws KadryzaValidationError for negative amount', async () => {
      await expect(
        transactions.initiate({ ...params, amount: -5000 })
      ).rejects.toThrow(KadryzaValidationError)
    })

    it('[M4] throws KadryzaValidationError for decimal amount', async () => {
      await expect(
        transactions.initiate({ ...params, amount: 50.5 })
      ).rejects.toThrow(KadryzaValidationError)
    })

    it('[M4] throws KadryzaValidationError for zero amount', async () => {
      await expect(
        transactions.initiate({ ...params, amount: 0 })
      ).rejects.toThrow(KadryzaValidationError)
    })

    it('[M4] throws KadryzaValidationError for NaN amount', async () => {
      await expect(
        transactions.initiate({ ...params, amount: NaN })
      ).rejects.toThrow(KadryzaValidationError)
    })

    it('[M4] throws KadryzaValidationError for Infinity amount', async () => {
      await expect(
        transactions.initiate({ ...params, amount: Infinity })
      ).rejects.toThrow(KadryzaValidationError)
    })

    it('[M4] does NOT reject valid positive integer amount', async () => {
      mockRequest.mockResolvedValue(mockTransaction())
      await expect(transactions.initiate({ ...params, amount: 1 })).resolves.toBeDefined()
    })
  })

  // ─── get() ──────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns a Transaction by ID', async () => {
      const expected = mockTransaction({ status: 'SUCCESS' })
      mockRequest.mockResolvedValue(expected)

      const result = await transactions.get('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

      expect(result).toEqual(expected)
      expect(mockRequest).toHaveBeenCalledWith(
        'GET',
        '/v1/transactions/a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      )
    })

    it('throws KadryzaNotFoundError when transaction does not exist', async () => {
      mockRequest.mockRejectedValue(
        new KadryzaNotFoundError('Transaction not found')
      )

      await expect(transactions.get('nonexistent-id')).rejects.toThrow(
        KadryzaNotFoundError
      )
    })

    it('encodes the transaction ID in the URL', async () => {
      mockRequest.mockResolvedValue(mockTransaction())

      await transactions.get('id/with/slashes')

      expect(mockRequest).toHaveBeenCalledWith(
        'GET',
        '/v1/transactions/id%2Fwith%2Fslashes'
      )
    })
  })

  // ─── list() ─────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns PaginatedTransactions with default params', async () => {
      const expected: PaginatedTransactions = {
        data: [mockTransaction()],
        total: 1,
        page: 1,
        per_page: 20,
      }
      mockRequest.mockResolvedValue(expected)

      const result = await transactions.list()

      expect(result).toEqual(expected)
      expect(mockRequest).toHaveBeenCalledWith('GET', '/v1/transactions', {
        query: {},
      })
    })

    it('passes all filter params as query strings', async () => {
      const expected: PaginatedTransactions = {
        data: [],
        total: 0,
        page: 2,
        per_page: 10,
      }
      mockRequest.mockResolvedValue(expected)

      await transactions.list({
        page: 2,
        per_page: 10,
        status: 'SUCCESS',
        operator: 'MOOV',
        from: '2024-01-01',
        to: '2024-01-31',
      })

      expect(mockRequest).toHaveBeenCalledWith('GET', '/v1/transactions', {
        query: {
          page: '2',
          per_page: '10',
          status: 'SUCCESS',
          operator: 'MOOV',
          from: '2024-01-01',
          to: '2024-01-31',
        },
      })
    })

    it('omits undefined filter params from query', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 })

      await transactions.list({ status: 'FAILED' })

      expect(mockRequest).toHaveBeenCalledWith('GET', '/v1/transactions', {
        query: { status: 'FAILED' },
      })
    })
  })
})
