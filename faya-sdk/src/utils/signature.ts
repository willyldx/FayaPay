import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VerifyWebhookParams } from '../types'

/**
 * Verify the authenticity of a FayaPay webhook request.
 *
 * Uses HMAC-SHA256 with constant-time comparison to prevent timing attacks.
 * This is a pure function — no side effects, no state.
 *
 * @example
 * ```ts
 * import { verifyWebhookSignature } from '@fayapay/sdk'
 *
 * const isValid = verifyWebhookSignature({
 *   payload: rawBody,
 *   signature: req.headers['x-faya-signature'],
 *   secret: process.env.FAYAPAY_WEBHOOK_SECRET!
 * })
 * ```
 */
export function verifyWebhookSignature(params: VerifyWebhookParams): boolean {
  const { payload, signature, secret } = params

  if (!signature) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')

  // Both are hex strings — same charset, but guard against length mismatch
  // which would throw in timingSafeEqual
  const sigBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(sigBuffer, expectedBuffer)
}
