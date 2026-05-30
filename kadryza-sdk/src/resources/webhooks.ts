import type {
  VerifyWebhookParams,
  CreateWebhookParams,
  CreatedWebhookEndpoint,
  WebhookEndpoint,
  WebhookTestResult,
} from '../types'
import { verifyWebhookSignature } from '../utils/signature'
import type { RequestFn } from '../client'

/**
 * Webhooks resource — endpoint management + signature verification.
 *
 * Not instantiated directly by merchants. Access via `kadryza.webhooks`.
 *
 * @example Verify an incoming webhook
 * ```ts
 * const isValid = kadryza.webhooks.verify({
 *   payload: rawBody,
 *   signature: req.headers['x-kadryza-signature'],
 *   secret: process.env.KADRYZA_WEBHOOK_SECRET!
 * })
 * ```
 *
 * @example Register an endpoint
 * ```ts
 * const endpoint = await kadryza.webhooks.create({ url: 'https://shop.td/webhooks/kadryza' })
 * console.log(endpoint.secret) // store this — shown only once
 * ```
 */
export class Webhooks {
  private readonly request: RequestFn

  /** @internal */
  constructor(request: RequestFn) {
    this.request = request
  }

  /**
   * Verify the HMAC-SHA256 signature of an incoming webhook request.
   * Runs locally — no API call.
   *
   * @returns `true` if the signature is valid, `false` otherwise
   */
  verify(params: VerifyWebhookParams): boolean {
    return verifyWebhookSignature(params)
  }

  /**
   * Register a new webhook endpoint.
   *
   * The returned `secret` is shown **only once** — store it securely and use it
   * with {@link verify} to authenticate incoming deliveries.
   *
   * @throws {KadryzaValidationError} If the URL is missing or invalid
   */
  async create(params: CreateWebhookParams): Promise<CreatedWebhookEndpoint> {
    return this.request<CreatedWebhookEndpoint>('POST', '/v1/webhooks', {
      body: params,
    })
  }

  /** List all registered webhook endpoints (secrets are never returned). */
  async list(): Promise<WebhookEndpoint[]> {
    const res = await this.request<{ endpoints: WebhookEndpoint[] }>(
      'GET',
      '/v1/webhooks'
    )
    return res.endpoints ?? []
  }

  /**
   * Delete a webhook endpoint by its UUID.
   *
   * @throws {KadryzaNotFoundError} If the endpoint does not exist
   */
  async delete(id: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/v1/webhooks/${encodeURIComponent(id)}`
    )
  }

  /**
   * Trigger a test delivery to a registered endpoint.
   *
   * @throws {KadryzaNotFoundError} If the endpoint does not exist
   */
  async test(id: string): Promise<WebhookTestResult> {
    return this.request<WebhookTestResult>(
      'POST',
      `/v1/webhooks/${encodeURIComponent(id)}/test`
    )
  }
}
