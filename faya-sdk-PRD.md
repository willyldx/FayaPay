# PRD — faya-sdk
> Document de référence pour Cursor. Lire entièrement avant de générer du code.
> Ce projet fait partie du monorepo `fayapay/faya-sdk/`

---

## 1. Contexte du projet

`faya-sdk` est le package npm officiel que les merchants installent dans
leur projet pour intégrer FayaPay en quelques lignes de code.

Il est un simple wrapper typé autour de l'API REST `faya-backend`.
Zéro logique métier — uniquement des appels HTTP propres avec TypeScript.

**Objectif :** Un merchant doit pouvoir intégrer FayaPay en moins de 10 minutes.

```bash
npm install @fayapay/sdk
```

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 18+ |
| HTTP Client | fetch natif (node 18+) | — |
| Build | tsup | latest |
| Tests | Vitest | latest |
| Lint | ESLint + Prettier | latest |
| Publish | npm public package | — |

**Zéro dépendance externe** — uniquement fetch natif.
Le SDK doit être léger, stable, et sans surprises.

---

## 3. Structure des dossiers

```
faya-sdk/
├── src/
│   ├── index.ts                  # Export public de tout le SDK
│   ├── client.ts                 # Classe principale FayaPay
│   ├── resources/
│   │   ├── transactions.ts       # Resource transactions
│   │   └── webhooks.ts           # Resource webhooks (vérification signature)
│   ├── types/
│   │   └── index.ts              # Tous les types publics du SDK
│   ├── errors/
│   │   └── index.ts              # Classes d'erreurs typées
│   └── utils/
│       └── signature.ts          # Vérification signature webhook HMAC-SHA256
├── tests/
│   ├── client.test.ts
│   ├── transactions.test.ts
│   └── signature.test.ts
├── examples/
│   ├── basic-payment.ts          # Exemple paiement simple
│   ├── webhook-verification.ts   # Exemple vérification webhook
│   └── nextjs-example.ts         # Exemple intégration Next.js
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .eslintrc.js
├── .prettierrc
└── README.md                     # Documentation complète
```

---

## 4. API publique du SDK

### Initialisation

```typescript
import FayaPay from '@fayapay/sdk'

const faya = new FayaPay({
  apiKey: 'faya_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  baseUrl: 'https://api.fayapay.app',  // optionnel, défaut production
  timeout: 30000                        // optionnel, défaut 30s
})
```

### Initier un paiement

```typescript
const transaction = await faya.transactions.initiate({
  reference: 'order_123',           // Référence unique de ta commande
  amount: 5000,                     // Montant en XAF (entier)
  currency: 'XAF',
  operator: 'AIRTEL',               // 'AIRTEL' | 'MOOV'
  phone_number: '+23566xxxxxxx',    // Numéro du payeur
  description: 'Commande #123'      // Optionnel
})

console.log(transaction.id)         // UUID de la transaction
console.log(transaction.status)     // 'PENDING'
console.log(transaction.expires_at) // Dans 5 minutes
```

### Vérifier le statut d'une transaction

```typescript
const transaction = await faya.transactions.get('uuid-de-la-transaction')
console.log(transaction.status) // 'SUCCESS' | 'FAILED' | 'TIMEOUT' | ...
```

### Lister les transactions

```typescript
const result = await faya.transactions.list({
  page: 1,
  per_page: 20,
  status: 'SUCCESS',        // Optionnel
  operator: 'AIRTEL',       // Optionnel
  from: '2024-01-01',       // Optionnel
  to: '2024-01-31'          // Optionnel
})

console.log(result.data)    // Transaction[]
console.log(result.total)   // Nombre total
```

### Vérifier la signature d'un webhook

```typescript
import { verifyWebhookSignature } from '@fayapay/sdk'

// Dans ton endpoint webhook (Express, Next.js, etc.)
const isValid = verifyWebhookSignature({
  payload: rawBody,           // Body brut (string)
  signature: req.headers['x-faya-signature'],
  secret: 'ton-secret-webhook'
})

if (!isValid) {
  return res.status(401).json({ error: 'Signature invalide' })
}
```

---

## 5. Types publics (`src/types/index.ts`)

```typescript
export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'WAITING_SMS'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'REFUNDED'

export type OperatorType = 'AIRTEL' | 'MOOV'
export type CurrencyType = 'XAF'

export interface FayaPayConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

export interface InitiateTransactionRequest {
  reference: string
  amount: number
  currency: CurrencyType
  operator: OperatorType
  phone_number: string
  description?: string
}

export interface Transaction {
  id: string
  reference: string
  internal_ref: string
  amount: number
  currency: CurrencyType
  operator: OperatorType
  phone_number: string
  description?: string
  status: TransactionStatus
  failure_reason?: string
  webhook_sent: boolean
  initiated_at: string
  confirmed_at?: string
  expires_at: string
  created_at: string
}

export interface TransactionListParams {
  page?: number
  per_page?: number
  status?: TransactionStatus
  operator?: OperatorType
  from?: string
  to?: string
}

export interface PaginatedTransactions {
  data: Transaction[]
  total: number
  page: number
  per_page: number
}

export interface WebhookPayload {
  event: 'transaction.success' | 'transaction.failed' | 'transaction.timeout'
  data: Transaction
  timestamp: string
}

export interface VerifyWebhookParams {
  payload: string
  signature: string | undefined
  secret: string
}
```

---

## 6. Classes d'erreurs (`src/errors/index.ts`)

```typescript
// Toutes les erreurs du SDK étendent FayaPayError
// pour que le merchant puisse les attraper facilement

export class FayaPayError extends Error {
  code: string
  statusCode?: number
}

export class FayaPayAuthError extends FayaPayError {
  // API key invalide ou expirée
  // code: 'UNAUTHORIZED'
}

export class FayaPayValidationError extends FayaPayError {
  // Paramètres invalides
  // code: 'VALIDATION_ERROR'
  fields?: Record<string, string>
}

export class FayaPayNotFoundError extends FayaPayError {
  // Transaction introuvable
  // code: 'NOT_FOUND'
}

export class FayaPayDuplicateError extends FayaPayError {
  // Référence déjà utilisée (idempotence)
  // code: 'DUPLICATE_REFERENCE'
  existingTransaction?: Transaction
}

export class FayaPayNetworkError extends FayaPayError {
  // Erreur réseau ou timeout
  // code: 'NETWORK_ERROR'
}

export class FayaPayGatewayUnavailableError extends FayaPayError {
  // Gateway Android déconnecté
  // code: 'GATEWAY_UNAVAILABLE'
}
```

---

## 7. Gestion des erreurs côté merchant

```typescript
import FayaPay, {
  FayaPayDuplicateError,
  FayaPayGatewayUnavailableError,
  FayaPayValidationError
} from '@fayapay/sdk'

try {
  const transaction = await faya.transactions.initiate({...})
} catch (error) {
  if (error instanceof FayaPayDuplicateError) {
    // Référence déjà utilisée — récupérer la transaction existante
    console.log(error.existingTransaction)
  } else if (error instanceof FayaPayGatewayUnavailableError) {
    // Gateway hors ligne — réessayer plus tard
    console.log('Service temporairement indisponible')
  } else if (error instanceof FayaPayValidationError) {
    // Paramètres invalides
    console.log(error.fields)
  } else {
    throw error
  }
}
```

---

## 8. Exemple webhook complet (`examples/webhook-verification.ts`)

```typescript
// Exemple Express.js
import express from 'express'
import { verifyWebhookSignature, WebhookPayload } from '@fayapay/sdk'

const app = express()

// IMPORTANT : utiliser express.raw() pour avoir le body brut
app.post('/webhooks/fayapay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const isValid = verifyWebhookSignature({
      payload: req.body.toString(),
      signature: req.headers['x-faya-signature'] as string,
      secret: process.env.FAYAPAY_WEBHOOK_SECRET!
    })

    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' })
    }

    const event: WebhookPayload = JSON.parse(req.body.toString())

    if (event.event === 'transaction.success') {
      // Confirmer la commande dans ta base de données
      console.log(`Paiement reçu : ${event.data.amount} XAF`)
      console.log(`Référence : ${event.data.reference}`)
    }

    res.json({ received: true })
  }
)
```

---

## 9. Exemple Next.js (`examples/nextjs-example.ts`)

```typescript
// app/api/pay/route.ts
import FayaPay from '@fayapay/sdk'
import { NextRequest, NextResponse } from 'next/server'

const faya = new FayaPay({
  apiKey: process.env.FAYAPAY_API_KEY!
})

export async function POST(req: NextRequest) {
  const body = await req.json()

  const transaction = await faya.transactions.initiate({
    reference: `order_${body.orderId}`,
    amount: body.amount,
    currency: 'XAF',
    operator: body.operator,
    phone_number: body.phone,
    description: `Commande #${body.orderId}`
  })

  return NextResponse.json({ transactionId: transaction.id })
}

// app/api/webhooks/fayapay/route.ts
import { verifyWebhookSignature } from '@fayapay/sdk'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-faya-signature') ?? ''

  const isValid = verifyWebhookSignature({
    payload: rawBody,
    signature,
    secret: process.env.FAYAPAY_WEBHOOK_SECRET!
  })

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'transaction.success') {
    // Mettre à jour ta commande en base
  }

  return NextResponse.json({ received: true })
}
```

---

## 10. README.md (documentation merchant)

Le README doit contenir dans l'ordre :
1. Badge npm version + licence
2. Installation (`npm install @fayapay/sdk`)
3. Quick start (5 lignes de code)
4. Guide complet : initier, vérifier, lister
5. Gestion des webhooks avec exemple Express + Next.js
6. Référence des erreurs avec exemples try/catch
7. Variables d'environnement recommandées
8. Support : email + lien dashboard

---

## 11. Configuration tsup (`tsup.config.ts`)

```typescript
// Builder les deux formats : ESM et CommonJS
// pour compatibilité maximale (Next.js, Express, etc.)
export default {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,           // Générer les fichiers .d.ts
  clean: true,
  minify: false,       // Lisible pour debug
  sourcemap: true
}
```

---

## 12. Exports publics (`src/index.ts`)

```typescript
// Export default : classe principale
export { default } from './client'

// Export named : types
export type {
  FayaPayConfig,
  Transaction,
  TransactionStatus,
  OperatorType,
  CurrencyType,
  InitiateTransactionRequest,
  TransactionListParams,
  PaginatedTransactions,
  WebhookPayload,
  VerifyWebhookParams
} from './types'

// Export named : erreurs
export {
  FayaPayError,
  FayaPayAuthError,
  FayaPayValidationError,
  FayaPayNotFoundError,
  FayaPayDuplicateError,
  FayaPayNetworkError,
  FayaPayGatewayUnavailableError
} from './errors'

// Export named : utilitaires
export { verifyWebhookSignature } from './utils/signature'
```

---

## 13. Règles critiques pour Cursor

1. **Zéro dépendance externe** — uniquement fetch natif Node.js 18+
2. **Dual format** — builder en CJS et ESM via tsup
3. **Types stricts** — pas de `any`, pas de `unknown` non géré
4. **Erreurs typées** — chaque cas d'erreur HTTP a sa classe dédiée
5. **Idempotence visible** — FayaPayDuplicateError expose la transaction existante
6. **verifyWebhookSignature est une fonction pure** — pas de classe, pas d'état
7. **Timeout configurable** — AbortController sur chaque requête fetch
8. **Tests sur les cas critiques** — signature valide, signature invalide, duplicate, gateway unavailable
9. **README orienté merchant** — pas de jargon technique, exemples concrets
10. **package.json correct** — `main`, `module`, `types`, `exports` bien configurés pour ESM + CJS
