/**
 * Webhook Verification Example (Express.js)
 *
 * Shows how to securely verify incoming Kadryza webhook requests
 * using HMAC-SHA256 signature verification.
 *
 * Run: npx tsx examples/webhook-verification.ts
 */
import express from 'express'
import { verifyWebhookSignature, type WebhookPayload } from '@kadryza/sdk'

const app = express()
const WEBHOOK_SECRET = process.env.KADRYZA_WEBHOOK_SECRET!

// IMPORTANT: Use express.raw() to get the raw body as a Buffer.
// express.json() would parse it and lose the exact byte representation
// needed for signature verification.
app.post(
  '/webhooks/kadryza',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const rawBody = req.body.toString('utf8')
    const signature = req.headers['x-kadryza-signature'] as string | undefined

    // 1. Verify the signature
    const isValid = verifyWebhookSignature({
      payload: rawBody,
      signature,
      secret: WEBHOOK_SECRET,
    })

    if (!isValid) {
      console.warn('⚠️  Invalid webhook signature — rejecting')
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    // 2. Parse the verified payload
    const event: WebhookPayload = JSON.parse(rawBody)

    console.log(`📬 Webhook received: ${event.event}`)
    console.log(`   Transaction: ${event.data.id}`)
    console.log(`   Reference:   ${event.data.reference}`)
    console.log(`   Amount:      ${event.data.amount} ${event.data.currency}`)

    // 3. Handle the event
    switch (event.event) {
      case 'transaction.success':
        // ✅ Payment confirmed — fulfill the order
        console.log('✅ Payment confirmed! Updating order status...')
        // await db.orders.update(event.data.reference, { status: 'paid' })
        break

      case 'transaction.failed':
        // ❌ Payment failed
        console.log(`❌ Payment failed: ${event.data.failure_reason}`)
        // await db.orders.update(event.data.reference, { status: 'failed' })
        break

      case 'transaction.timeout':
        // ⏰ Payment timed out (user didn't confirm on their phone)
        console.log('⏰ Payment timed out')
        // await db.orders.update(event.data.reference, { status: 'expired' })
        break
    }

    // 4. Always respond 200 quickly to acknowledge receipt
    res.json({ received: true })
  }
)

app.listen(3000, () => {
  console.log('🚀 Webhook server listening on http://localhost:3000')
})
