/**
 * Next.js Integration Example
 *
 * Two API routes:
 *   1. POST /api/pay       — Initiate a payment
 *   2. POST /api/webhooks  — Receive and verify webhook callbacks
 *
 * These files go in your Next.js app directory:
 *   app/api/pay/route.ts
 *   app/api/webhooks/kadryza/route.ts
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: app/api/pay/route.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Kadryza, {
  KadryzaValidationError,
  KadryzaGatewayUnavailableError,
} from '@kadryza/sdk'
import { NextRequest, NextResponse } from 'next/server'

const kadryza = new Kadryza({
  apiKey: process.env.KADRYZA_API_KEY!,
})

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const transaction = await kadryza.transactions.initiate({
      reference: `order_${body.orderId}`,
      amount: body.amount,
      currency: 'XAF',
      operator: body.operator,        // 'AIRTEL' | 'MOOV'
      phone_number: body.phone,
      description: `Commande #${body.orderId}`,
    })

    return NextResponse.json({
      transactionId: transaction.id,
      status: transaction.status,
      expiresAt: transaction.expires_at,
    })
  } catch (error) {
    if (error instanceof KadryzaValidationError) {
      return NextResponse.json(
        { error: 'Invalid payment parameters', fields: error.fields },
        { status: 422 }
      )
    }
    if (error instanceof KadryzaGatewayUnavailableError) {
      return NextResponse.json(
        { error: 'Payment service temporarily unavailable' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: app/api/webhooks/kadryza/route.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { verifyWebhookSignature, type WebhookPayload } from '@kadryza/sdk'
// import { NextRequest, NextResponse } from 'next/server'

export async function POST_webhook(req: NextRequest) {
  // Next.js App Router: use req.text() to get the raw body
  const rawBody = await req.text()
  const signature = req.headers.get('x-kadryza-signature') ?? undefined

  const isValid = verifyWebhookSignature({
    payload: rawBody,
    signature,
    secret: process.env.KADRYZA_WEBHOOK_SECRET!,
  })

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event: WebhookPayload = JSON.parse(rawBody)

  switch (event.event) {
    case 'transaction.success':
      // Update your database: mark order as paid
      // await prisma.order.update({
      //   where: { reference: event.data.reference },
      //   data: { status: 'PAID', paidAt: new Date() },
      // })
      break

    case 'transaction.failed':
      // Handle failure
      break

    case 'transaction.timeout':
      // Handle timeout — maybe send user a retry notification
      break
  }

  return NextResponse.json({ received: true })
}
