/**
 * Basic Payment Example
 *
 * Shows how to initiate a mobile money payment with FayaPay
 * and handle common error cases.
 *
 * Run: npx tsx examples/basic-payment.ts
 */
import FayaPay, {
  FayaPayDuplicateError,
  FayaPayGatewayUnavailableError,
  FayaPayValidationError,
} from '@fayapay/sdk'

const faya = new FayaPay({
  apiKey: process.env.FAYAPAY_API_KEY!,
  // baseUrl: 'https://api.fayapay.app', // default — production
})

async function main() {
  try {
    // 1. Initiate a payment
    const transaction = await faya.transactions.initiate({
      reference: `order_${Date.now()}`,
      amount: 5000,           // 5,000 XAF
      currency: 'XAF',
      operator: 'AIRTEL',     // 'AIRTEL' | 'MOOV'
      phone_number: '+23566000000',
      description: 'Achat T-shirt FayaPay',
    })

    console.log('✅ Payment initiated!')
    console.log(`   Transaction ID: ${transaction.id}`)
    console.log(`   Status:         ${transaction.status}`)
    console.log(`   Expires at:     ${transaction.expires_at}`)

    // 2. Check status later
    const updated = await faya.transactions.get(transaction.id)
    console.log(`\n📊 Current status: ${updated.status}`)

    // 3. List recent transactions
    const list = await faya.transactions.list({
      page: 1,
      per_page: 5,
      status: 'SUCCESS',
    })
    console.log(`\n📋 ${list.total} successful transactions found`)
    for (const tx of list.data) {
      console.log(`   - ${tx.reference}: ${tx.amount} ${tx.currency}`)
    }
  } catch (error) {
    if (error instanceof FayaPayDuplicateError) {
      console.error('⚠️  Reference already used!')
      console.error(`   Existing TX: ${error.existingTransaction?.id}`)
    } else if (error instanceof FayaPayGatewayUnavailableError) {
      console.error('🔌 Payment gateway is offline. Try again later.')
    } else if (error instanceof FayaPayValidationError) {
      console.error('❌ Invalid parameters:', error.fields)
    } else {
      throw error
    }
  }
}

main()
