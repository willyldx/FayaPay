# @fayapay/sdk

[![npm version](https://img.shields.io/npm/v/@fayapay/sdk.svg)](https://www.npmjs.com/package/@fayapay/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> SDK officiel FayaPay pour Node.js — Intégrez le paiement mobile money en quelques lignes de code.

---

## Installation

```bash
npm install @fayapay/sdk
```

> **Prérequis** : Node.js 18+ (utilise `fetch` natif — zéro dépendance externe).

---

## Quick Start

```typescript
import FayaPay from '@fayapay/sdk'

const faya = new FayaPay({
  apiKey: process.env.FAYAPAY_API_KEY!,
})

const transaction = await faya.transactions.initiate({
  reference: 'order_123',
  amount: 5000,
  currency: 'XAF',
  operator: 'AIRTEL',
  phone_number: '+23566000000',
})

console.log(transaction.id)     // UUID de la transaction
console.log(transaction.status) // 'PENDING'
```

**5 lignes de code. C'est tout.**

---

## Guide complet

### Initier un paiement

```typescript
const transaction = await faya.transactions.initiate({
  reference: 'order_123',       // Référence unique de ta commande
  amount: 5000,                 // Montant en XAF (entier, pas de décimales)
  currency: 'XAF',
  operator: 'AIRTEL',           // 'AIRTEL' | 'MOOV'
  phone_number: '+23566000000', // Numéro du payeur (format international)
  description: 'Commande #123', // Optionnel
})
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `reference` | `string` | ✅ | Référence unique de ta commande |
| `amount` | `number` | ✅ | Montant en XAF (entier) |
| `currency` | `'XAF'` | ✅ | Code devise |
| `operator` | `'AIRTEL' \| 'MOOV'` | ✅ | Opérateur mobile money |
| `phone_number` | `string` | ✅ | Numéro au format international |
| `description` | `string` | ❌ | Description lisible |

### Vérifier le statut d'une transaction

```typescript
const transaction = await faya.transactions.get('uuid-de-la-transaction')

console.log(transaction.status)
// 'PENDING' | 'PROCESSING' | 'WAITING_SMS' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'REFUNDED'
```

### Lister les transactions

```typescript
const result = await faya.transactions.list({
  page: 1,
  per_page: 20,
  status: 'SUCCESS',    // Optionnel — filtrer par statut
  operator: 'AIRTEL',   // Optionnel — filtrer par opérateur
  from: '2024-01-01',   // Optionnel — date de début
  to: '2024-01-31',     // Optionnel — date de fin
})

console.log(result.data)   // Transaction[]
console.log(result.total)  // Nombre total de résultats
```

---

## Webhooks

FayaPay envoie des webhooks pour notifier ton serveur en temps réel quand le statut d'une transaction change.

### Vérifier la signature

Chaque webhook inclut un header `x-faya-signature` contenant une signature HMAC-SHA256. **Toujours vérifier cette signature** avant de traiter le webhook.

```typescript
import { verifyWebhookSignature } from '@fayapay/sdk'

const isValid = verifyWebhookSignature({
  payload: rawBody,                              // Body brut (string)
  signature: req.headers['x-faya-signature'],    // Header de signature
  secret: process.env.FAYAPAY_WEBHOOK_SECRET!,   // Ton secret webhook
})
```

### Exemple Express.js

```typescript
import express from 'express'
import { verifyWebhookSignature, type WebhookPayload } from '@fayapay/sdk'

const app = express()

// ⚠️ IMPORTANT : utiliser express.raw() — pas express.json()
app.post(
  '/webhooks/fayapay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const isValid = verifyWebhookSignature({
      payload: req.body.toString(),
      signature: req.headers['x-faya-signature'] as string,
      secret: process.env.FAYAPAY_WEBHOOK_SECRET!,
    })

    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' })
    }

    const event: WebhookPayload = JSON.parse(req.body.toString())

    if (event.event === 'transaction.success') {
      console.log(`✅ Paiement reçu : ${event.data.amount} XAF`)
      console.log(`   Référence : ${event.data.reference}`)
    }

    res.json({ received: true })
  }
)
```

### Exemple Next.js (App Router)

```typescript
// app/api/webhooks/fayapay/route.ts
import { verifyWebhookSignature, type WebhookPayload } from '@fayapay/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-faya-signature') ?? undefined

  const isValid = verifyWebhookSignature({
    payload: rawBody,
    signature,
    secret: process.env.FAYAPAY_WEBHOOK_SECRET!,
  })

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event: WebhookPayload = JSON.parse(rawBody)

  if (event.event === 'transaction.success') {
    // Marquer la commande comme payée dans ta base de données
  }

  return NextResponse.json({ received: true })
}
```

### Types d'événements

| Événement | Description |
|---|---|
| `transaction.success` | Le paiement a été confirmé |
| `transaction.failed` | Le paiement a échoué |
| `transaction.timeout` | Le paiement a expiré (l'utilisateur n'a pas confirmé) |

---

## Gestion des erreurs

Toutes les erreurs du SDK étendent `FayaPayError`. Tu peux les attraper individuellement :

```typescript
import FayaPay, {
  FayaPayValidationError,
  FayaPayDuplicateError,
  FayaPayGatewayUnavailableError,
  FayaPayAuthError,
  FayaPayNotFoundError,
  FayaPayNetworkError,
} from '@fayapay/sdk'

try {
  const tx = await faya.transactions.initiate({ ... })
} catch (error) {
  if (error instanceof FayaPayDuplicateError) {
    // Référence déjà utilisée — récupère la transaction existante
    console.log(error.existingTransaction)
  } else if (error instanceof FayaPayGatewayUnavailableError) {
    // Gateway hors ligne — réessaie plus tard
    console.log('Service temporairement indisponible')
  } else if (error instanceof FayaPayValidationError) {
    // Paramètres invalides
    console.log(error.fields) // { amount: 'must be positive', ... }
  } else if (error instanceof FayaPayAuthError) {
    // API key invalide ou expirée
  } else if (error instanceof FayaPayNetworkError) {
    // Erreur réseau ou timeout
  } else {
    throw error
  }
}
```

### Référence des erreurs

| Classe | Code | HTTP | Quand |
|---|---|---|---|
| `FayaPayAuthError` | `UNAUTHORIZED` | 401 | API key invalide ou expirée |
| `FayaPayValidationError` | `VALIDATION_ERROR` | 422 | Paramètres de requête invalides |
| `FayaPayNotFoundError` | `NOT_FOUND` | 404 | Transaction introuvable |
| `FayaPayDuplicateError` | `DUPLICATE_REFERENCE` | 409 | Référence déjà utilisée |
| `FayaPayNetworkError` | `NETWORK_ERROR` | — | Erreur réseau ou timeout |
| `FayaPayGatewayUnavailableError` | `GATEWAY_UNAVAILABLE` | 503 | Gateway Android déconnecté |

---

## Configuration

### Options du constructeur

```typescript
const faya = new FayaPay({
  apiKey: 'faya_live_xxx',                    // Requis
  baseUrl: 'https://api.fayapay.app',         // Optionnel (défaut: production)
  timeout: 30000,                             // Optionnel (défaut: 30s)
})
```

### Variables d'environnement recommandées

```bash
# .env
FAYAPAY_API_KEY=faya_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FAYAPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 Utilise `faya_test_xxx` en développement et `faya_live_xxx` en production.

---

## Compatibilité runtime

| Runtime | Supporté | Notes |
|---|---|---|
| **Node.js 18+** | ✅ | Pleinement supporté |
| **Node.js 20+** | ✅ | Pleinement supporté |
| **Bun** | ✅ | Compatible (fetch natif) |
| **Next.js (Node runtime)** | ✅ | Pleinement supporté |
| **Next.js Edge Runtime** | ⚠️ | `verifyWebhookSignature` utilise `node:crypto` — non disponible en Edge. Utilisez le Node runtime pour vos routes webhook. |
| **Cloudflare Workers** | ⚠️ | Même limitation que Edge Runtime pour la vérification de signature. |
| **Deno** | ⚠️ | Compatible via le flag `--compat` pour `node:crypto`. |

> ⚠️ **Next.js Edge Runtime** : Si tu utilises le Edge Runtime pour tes routes API, configure le webhook handler en **Node runtime** :
> ```typescript
> // app/api/webhooks/fayapay/route.ts
> export const runtime = 'nodejs'  // ← Force Node runtime pour cette route
> ```

---

## Sécurité

- **L'API key n'est jamais exposée** dans les logs, `console.log`, ou `JSON.stringify` de l'instance SDK.
- **Les signatures webhook** sont vérifiées en temps constant (`timingSafeEqual`) pour prévenir les timing attacks.
- **`baseUrl` doit être HTTPS** en production — le SDK rejette les URLs HTTP non-localhost.
- **Les numéros de téléphone** sont redactés dans les erreurs `FayaPayDuplicateError` pour éviter les fuites de PII dans les logs.

---

## Support

- 📧 Email : [support@fayapay.app](mailto:support@fayapay.app)
- 🖥️ Dashboard : [https://dashboard.fayapay.app](https://dashboard.fayapay.app)
- 📖 Documentation API : [https://docs.fayapay.app](https://docs.fayapay.app)

---

## Licence

MIT © [FayaPay](https://fayapay.app)
