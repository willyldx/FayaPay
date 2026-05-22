import type {
  InitiateTransactionRequest,
  PaginatedTransactions,
  Transaction,
  TransactionListParams,
} from '../types'
import { KadryzaValidationError } from '../errors'
import type { RequestFn } from '../client'

/**
 * Transactions resource — handles all transaction-related API calls.
 *
 * Not instantiated directly by merchants. Access via `kadryza.transactions`.
 */
export class Transactions {
  private readonly request: RequestFn

  /** @internal */
  constructor(request: RequestFn) {
    this.request = request
  }

  /**
   * Initiate a new mobile money payment.
   *
   * The returned transaction will have status `PENDING`.
   * Listen for webhooks or poll `get()` to track completion.
   *
   * @throws {KadryzaValidationError} If parameters are invalid
   * @throws {KadryzaDuplicateError} If the reference was already used
   * @throws {KadryzaGatewayUnavailableError} If the payment gateway is offline
   */
  async initiate(params: InitiateTransactionRequest): Promise<Transaction> {
    // [M4 FIX] Fail-fast on obviously invalid amount
    if (
      !Number.isFinite(params.amount) ||
      !Number.isInteger(params.amount) ||
      params.amount <= 0
    ) {
      throw new KadryzaValidationError(
        `amount must be a positive integer. Received: ${params.amount}`,
        { amount: 'must be a positive integer (XAF, no decimals)' }
      )
    }

    return this.request<Transaction>('POST', '/v1/transactions', {
      body: params,
    })
  }

  /**
   * Retrieve a single transaction by its UUID.
   *
   * @param id - The transaction UUID returned by `initiate()`
   * @throws {KadryzaNotFoundError} If the transaction does not exist
   */
  async get(id: string): Promise<Transaction> {
    return this.request<Transaction>('GET', `/v1/transactions/${encodeURIComponent(id)}`)
  }

  /**
   * List transactions with optional filters and pagination.
   *
   * @param params - Optional filters: status, operator, date range, pagination
   */
  async list(params: TransactionListParams = {}): Promise<PaginatedTransactions> {
    const query: Record<string, string> = {}

    if (params.page !== undefined) query['page'] = String(params.page)
    if (params.per_page !== undefined) query['per_page'] = String(params.per_page)
    if (params.status !== undefined) query['status'] = params.status
    if (params.operator !== undefined) query['operator'] = params.operator
    if (params.from !== undefined) query['from'] = params.from
    if (params.to !== undefined) query['to'] = params.to

    return this.request<PaginatedTransactions>('GET', '/v1/transactions', { query })
  }
}
