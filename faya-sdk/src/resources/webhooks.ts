import type { VerifyWebhookParams } from '../types'
import { verifyWebhookSignature } from '../utils/signature'

/**
 * Webhooks resource — provides webhook signature verification.
 *
 * Not instantiated directly by merchants. Access via `faya.webhooks`.
 *
 * @example
 * ```ts
 * const isValid = faya.webhooks.verify({
 *   payload: rawBody,
 *   signature: req.headers['x-faya-signature'],
 *   secret: process.env.FAYAPAY_WEBHOOK_SECRET!
 * })
 * ```
 */
export class Webhooks {
  /**
   * Verify the HMAC-SHA256 signature of an incoming webhook request.
   *
   * @returns `true` if the signature is valid, `false` otherwise
   */
  verify(params: VerifyWebhookParams): boolean {
    return verifyWebhookSignature(params)
  }
}
