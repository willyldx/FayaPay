# @kadryza/sdk

[![npm version](https://img.shields.io/npm/v/@kadryza/sdk.svg)](https://www.npmjs.com/package/@kadryza/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> SDK officiel Kadryza pour Node.js — Intégrez le paiement mobile money en quelques lignes de code.

---

## Installation

```bash
npm install @kadryza/sdk
```

> **Prérequis** : Node.js 18+ (utilise `fetch` natif — zéro dépendance externe).

---

## Quick Start

```typescript
import Kadryza from '@kadryza/sdk'

const kadryza = new Kadryza({
  apiKey: process.env.KADRYZA_API_KEY!,
})

const transaction = await kadryza.transactions.initiate({
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
const transaction = await kadryza.transactions.initiate({
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
const transaction = await kadryza.transactions.get('uuid-de-la-transaction')

console.log(transaction.status)
// 'PENDING' | 'PROCESSING' | 'WAITING_SMS' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'REFUNDED'
```

### Lister les transactions

```typescript
const result = await kadryza.transactions.list({
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

Kadryza envoie des webhooks pour notifier ton serveur en temps réel quand le statut d'une transaction change.

### Vérifier la signature

Chaque webhook inclut un header `x-kadryza-signature` contenant une signature HMAC-SHA256. **Toujours vérifier cette signature** avant de traiter le webhook.

```typescript
import { verifyWebhookSignature } from '@kadryza/sdk'

const isValid = verifyWebhookSignature({
  payload: rawBody,                              // Body brut (string)
  signature: req.headers['x-kadryza-signature'],    // Header de signature
  secret: process.env.KADRYZA_WEBHOOK_SECRET!,   // Ton secret webhook
})
```

### Exemple Express.js

```typescript
import express from 'express'
import { verifyWebhookSignature, type WebhookPayload } from '@kadryza/sdk'

const app = express()

// ⚠️ IMPORTANT : utiliser express.raw() — pas express.json()
app.post(
  '/webhooks/kadryza',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const isValid = verifyWebhookSignature({
      payload: req.body.toString(),
      signature: req.headers['x-kadryza-signature'] as string,
      secret: process.env.KADRYZA_WEBHOOK_SECRET!,
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
// app/api/webhooks/kadryza/route.ts
import { verifyWebhookSignature, type WebhookPayload } from '@kadryza/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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

Toutes les erreurs du SDK étendent `KadryzaError`. Tu peux les attraper individuellement :

```typescript
import Kadryza, {
  KadryzaValidationError,
  KadryzaDuplicateError,
  KadryzaGatewayUnavailableError,
  KadryzaAuthError,
  KadryzaNotFoundError,
  KadryzaNetworkError,
} from '@kadryza/sdk'

try {
  const tx = await kadryza.transactions.initiate({ ... })
} catch (error) {
  if (error instanceof KadryzaDuplicateError) {
    // Référence déjà utilisée — récupère la transaction existante
    console.log(error.existingTransaction)
  } else if (error instanceof KadryzaGatewayUnavailableError) {
    // Gateway hors ligne — réessaie plus tard
    console.log('Service temporairement indisponible')
  } else if (error instanceof KadryzaValidationError) {
    // Paramètres invalides
    console.log(error.fields) // { amount: 'must be positive', ... }
  } else if (error instanceof KadryzaAuthError) {
    // API key invalide ou expirée
  } else if (error instanceof KadryzaNetworkError) {
    // Erreur réseau ou timeout
  } else {
    throw error
  }
}
```

### Référence des erreurs

| Classe | Code | HTTP | Quand |
|---|---|---|---|
| `KadryzaAuthError` | `UNAUTHORIZED` | 401 | API key invalide ou expirée |
| `KadryzaValidationError` | `VALIDATION_ERROR` | 422 | Paramètres de requête invalides |
| `KadryzaNotFoundError` | `NOT_FOUND` | 404 | Transaction introuvable |
| `KadryzaDuplicateError` | `DUPLICATE_REFERENCE` | 409 | Référence déjà utilisée |
| `KadryzaNetworkError` | `NETWORK_ERROR` | — | Erreur réseau ou timeout |
| `KadryzaGatewayUnavailableError` | `GATEWAY_UNAVAILABLE` | 503 | Gateway Android déconnecté |

---

## Configuration

### Options du constructeur

```typescript
const kadryza = new Kadryza({
  apiKey: 'kadryza_live_xxx',                    // Requis
  baseUrl: 'https://api.kadryza.app',         // Optionnel (défaut: production)
  timeout: 30000,                             // Optionnel (défaut: 30s)
})
```

### Variables d'environnement recommandées

```bash
# .env
KADRYZA_API_KEY=kadryza_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KADRYZA_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 Utilise `kadryza_test_xxx` en développement et `kadryza_live_xxx` en production.

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
> // app/api/webhooks/kadryza/route.ts
> export const runtime = 'nodejs'  // ← Force Node runtime pour cette route
> ```

---

## Sécurité

- **L'API key n'est jamais exposée** dans les logs, `console.log`, ou `JSON.stringify` de l'instance SDK.
- **Les signatures webhook** sont vérifiées en temps constant (`timingSafeEqual`) pour prévenir les timing attacks.
- **`baseUrl` doit être HTTPS** en production — le SDK rejette les URLs HTTP non-localhost.
- **Les numéros de téléphone** sont redactés dans les erreurs `KadryzaDuplicateError` pour éviter les fuites de PII dans les logs.

---

## Support

- 📧 Email : [support@kadryza.app](mailto:support@kadryza.app)
- 🖥️ Dashboard : [https://dashboard.kadryza.app](https://dashboard.kadryza.app)
- 📖 Documentation API : [https://docs.kadryza.app](https://docs.kadryza.app)

---

## Licence

MIT © [Kadryza](https://kadryza.app)
