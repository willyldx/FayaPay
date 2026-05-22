import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from '../src/utils/signature'

/** Helper — produce a valid HMAC-SHA256 hex signature */
function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test_abcdef1234567890'
  const payload = JSON.stringify({
    event: 'transaction.success',
    data: { id: 'tx_001', amount: 5000, reference: 'order_42' },
    timestamp: '2024-06-15T10:30:00Z',
  })

  it('returns true for a valid signature', () => {
    const signature = sign(payload, secret)

    const result = verifyWebhookSignature({ payload, signature, secret })

    expect(result).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: 'deadbeef0000000000000000000000000000000000000000000000000000cafe',
      secret,
    })

    expect(result).toBe(false)
  })

  it('returns false when signature is undefined', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: undefined,
      secret,
    })

    expect(result).toBe(false)
  })

  it('returns false when signature is an empty string', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: '',
      secret,
    })

    expect(result).toBe(false)
  })

  it('returns false when the payload has been tampered with', () => {
    const signature = sign(payload, secret)
    const tampered = payload.replace('5000', '99999')

    const result = verifyWebhookSignature({
      payload: tampered,
      signature,
      secret,
    })

    expect(result).toBe(false)
  })

  it('returns false when signed with a different secret', () => {
    const signature = sign(payload, 'wrong_secret')

    const result = verifyWebhookSignature({ payload, signature, secret })

    expect(result).toBe(false)
  })

  it('returns false for a signature with wrong length', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: 'tooshort',
      secret,
    })

    expect(result).toBe(false)
  })
})
