/**
 * Basic Payment Example
 *
 * Shows how to initiate a mobile money payment with Kadryza
 * and handle common error cases.
 *
 * Run: npx tsx examples/basic-payment.ts
 */
import Kadryza, {
  KadryzaDuplicateError,
  KadryzaGatewayUnavailableError,
  KadryzaValidationError,
} from '@kadryza/sdk'

const kadryza = new Kadryza({
  apiKey: process.env.KADRYZA_API_KEY!,
  // baseUrl: 'https://api.kadryza.app', // default — production
})

async function main() {
  try {
    // 1. Initiate a payment
    const transaction = await kadryza.transactions.initiate({
      reference: `order_${Date.now()}`,
      amount: 5000,           // 5,000 XAF
      currency: 'XAF',
      operator: 'AIRTEL',     // 'AIRTEL' | 'MOOV'
      phone_number: '+23566000000',
      description: 'Achat T-shirt Kadryza',
    })

    console.log('✅ Payment initiated!')
    console.log(`   Transaction ID: ${transaction.id}`)
    console.log(`   Status:         ${transaction.status}`)
    console.log(`   Expires at:     ${transaction.expires_at}`)

    // 2. Check status later
    const updated = await kadryza.transactions.get(transaction.id)
    console.log(`\n📊 Current status: ${updated.status}`)

    // 3. List recent transactions
    const list = await kadryza.transactions.list({
      page: 1,
      per_page: 5,
      status: 'SUCCESS',
    })
    console.log(`\n📋 ${list.total} successful transactions found`)
    for (const tx of list.data) {
      console.log(`   - ${tx.reference}: ${tx.amount} ${tx.currency}`)
    }
  } catch (error) {
    if (error instanceof KadryzaDuplicateError) {
      console.error('⚠️  Reference already used!')
      console.error(`   Existing TX: ${error.existingTransaction?.id}`)
    } else if (error instanceof KadryzaGatewayUnavailableError) {
      console.error('🔌 Payment gateway is offline. Try again later.')
    } else if (error instanceof KadryzaValidationError) {
      console.error('❌ Invalid parameters:', error.fields)
    } else {
      throw error
    }
  }
}

main()
