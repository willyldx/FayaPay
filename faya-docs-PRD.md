# PRD — faya-docs
> Document de référence pour Cursor. Lire entièrement avant de générer du code.
> Ce projet fait partie du monorepo `fayapay/faya-docs/`

---

## 1. Contexte du projet

`faya-docs` est le site de documentation publique de FayaPay.
C'est ce que lisent les développeurs avant d'intégrer le SDK ou l'API.

**Objectif :** Un développeur doit pouvoir intégrer FayaPay
dans son projet en moins de 15 minutes après avoir lu la doc.

**URL cible :** `docs.fayapay.app`

---

## 2. Stack technique

| Couche | Technologie | Pourquoi |
|---|---|---|
| Framework | Nextra 3 (Next.js) | Markdown + MDX, fait pour la doc |
| Language | MDX + TypeScript | Contenu + composants interactifs |
| Styling | Tailwind CSS | Cohérent avec le dashboard |
| Syntax highlight | Shiki | Coloration syntaxique précise |
| Search | Flexsearch (intégré Nextra) | Recherche locale, pas de clé API |
| Deploy | Vercel | Zero config avec Nextra |

---

## 3. Structure des dossiers

```
faya-docs/
├── pages/
│   ├── index.mdx                        # Page d'accueil
│   ├── _meta.json                       # Ordre navigation sidebar
│   ├── quickstart.mdx                   # Démarrage rapide (5 min)
│   ├── authentication.mdx               # Guide authentification API
│   ├── api-reference/
│   │   ├── _meta.json
│   │   ├── index.mdx                    # Introduction API REST
│   │   ├── transactions.mdx             # Endpoint transactions
│   │   └── webhooks.mdx                 # Endpoint webhooks
│   ├── guides/
│   │   ├── _meta.json
│   │   ├── nextjs.mdx                   # Intégration Next.js
│   │   ├── expressjs.mdx                # Intégration Express.js
│   │   └── webhook-verification.mdx     # Guide webhooks complet
│   ├── sdk/
│   │   ├── _meta.json
│   │   ├── index.mdx                    # Vue d'ensemble SDK
│   │   └── reference.mdx                # Référence complète SDK
│   └── errors.mdx                       # Codes d'erreur + solutions
├── components/
│   ├── RequestExample.tsx               # Bloc curl + SDK côte à côte
│   ├── ResponseExample.tsx              # Bloc réponse JSON formaté
│   ├── StatusBadge.tsx                  # Badge statut transaction
│   ├── EndpointHeader.tsx               # Header endpoint (méthode + path)
│   └── ParamTable.tsx                   # Tableau paramètres API
├── theme.config.tsx                     # Config Nextra (logo, nav, footer)
├── next.config.js
├── tailwind.config.js
├── package.json
└── .env.local.example
```

---

## 4. Contenu de chaque page

### 4.1 Page d'accueil (`index.mdx`)

```
- Titre : "Documentation FayaPay"
- Sous-titre : "L'infrastructure de paiement Mobile Money
  pour le Tchad et la zone CEMAC"
- 3 cards de démarrage rapide :
    → Démarrage rapide (5 min)
    → Référence API
    → SDK JavaScript
- Section "Comment ça marche" en 3 étapes :
    1. Créer un compte merchant
    2. Obtenir une clé API
    3. Initier un paiement
- Lien vers le dashboard
```

### 4.2 Démarrage rapide (`quickstart.mdx`)

```
Étape 1 — Créer un compte
  → Lien vers dashboard.fayapay.app/register

Étape 2 — Obtenir une clé API
  → Dashboard > API Keys > Créer une clé

Étape 3 — Installer le SDK
  npm install @fayapay/sdk

Étape 4 — Premier paiement (code complet)
  import FayaPay from '@fayapay/sdk'
  const faya = new FayaPay({ apiKey: 'faya_live_...' })
  const transaction = await faya.transactions.initiate({...})

Étape 5 — Configurer un webhook
  → Guide webhook en lien

Note importante :
  Les paiements sont traités en XAF (Franc CFA CEMAC)
  Opérateurs supportés : Airtel Money, Moov Money (Tchad)
```

### 4.3 Authentification (`authentication.mdx`)

```
- Deux types d'auth expliqués :
    → JWT (pour le dashboard — pas pour l'API)
    → API Key (pour l'intégration merchant)

- Format de la clé API :
    faya_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    (préfixe faya_live_ + 32 caractères aléatoires)

- Comment utiliser la clé :
    Header HTTP : Authorization: Bearer faya_live_xxx

- Sécurité :
    → Ne jamais exposer la clé côté client (browser)
    → Utiliser des variables d'environnement
    → La clé n'est affichée qu'une seule fois à la création

- Exemple .env :
    FAYAPAY_API_KEY=faya_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.4 Référence API — Transactions (`api-reference/transactions.mdx`)

**Initier un paiement**
```
POST /v1/transactions

Paramètres :
- reference (string, requis) — Référence unique de ta commande
- amount (integer, requis) — Montant en XAF, entier positif
- currency (string, requis) — "XAF" uniquement
- operator (string, requis) — "AIRTEL" ou "MOOV"
- phone_number (string, requis) — Numéro au format +235XXXXXXXX
- description (string, optionnel) — Max 255 caractères

Réponse 201 :
- id — UUID de la transaction FayaPay
- internal_ref — Référence interne FAYA-XXXXXXXX
- status — "PENDING"
- expires_at — Expiration dans 5 minutes

Idempotence :
Si tu envoies deux fois la même reference,
FayaPay retourne la transaction existante
sans créer de doublon.
```

**Récupérer une transaction**
```
GET /v1/transactions/:id

Réponse 200 : Transaction complète avec statut actuel
```

**Lister les transactions**
```
GET /v1/transactions

Query params :
- page (integer, défaut: 1)
- per_page (integer, défaut: 20, max: 100)
- status (string, optionnel)
- operator (string, optionnel)
- from (date ISO, optionnel)
- to (date ISO, optionnel)
```

### 4.5 Référence API — Webhooks (`api-reference/webhooks.mdx`)

```
- Pourquoi les webhooks :
  Le statut d'une transaction change de façon asynchrone.
  Ne pas poller /v1/transactions/:id toutes les secondes —
  utiliser les webhooks.

- Events disponibles :
    transaction.success
    transaction.failed
    transaction.timeout

- Format du payload :
  {
    "event": "transaction.success",
    "data": { ...transaction complète },
    "timestamp": "2024-01-15T10:02:31Z"
  }

- Vérification de signature :
  Header X-Faya-Signature: sha256=<hmac_hex>
  Toujours vérifier avant de traiter le webhook.

- Retry policy :
  4 tentatives : 1min → 5min → 30min → 2h
  Un webhook est considéré délivré si HTTP 2xx reçu.

- Bonnes pratiques :
    → Répondre HTTP 200 immédiatement
    → Traiter en async (queue)
    → Vérifier la signature AVANT tout traitement
    → Vérifier l'idempotence (même event peut arriver 2x)
```

### 4.6 Guide Next.js (`guides/nextjs.mdx`)

```
- Installation SDK
- Configuration variable d'environnement
- Route API pour initier un paiement
- Route API pour recevoir les webhooks
- Vérification signature
- Exemple complet avec gestion d'erreurs
- Code complet copier-coller
```

### 4.7 Guide Express.js (`guides/expressjs.mdx`)

```
- Installation SDK
- Configuration
- Endpoint paiement
- Endpoint webhook avec express.raw()
- Vérification signature
- Exemple complet
```

### 4.8 Codes d'erreur (`errors.mdx`)

```
Tableau complet :

Code HTTP | Code erreur          | Description | Solution
----------|----------------------|-------------|--------
400       | VALIDATION_ERROR     | Paramètres invalides | Vérifier les champs requis
401       | UNAUTHORIZED         | Clé API invalide | Vérifier la clé dans le dashboard
404       | NOT_FOUND            | Transaction introuvable | Vérifier l'UUID
409       | DUPLICATE_REFERENCE  | Référence déjà utilisée | Récupérer la transaction existante
422       | VALIDATION_ERROR     | Données incorrectes | Voir le champ "fields"
503       | GATEWAY_UNAVAILABLE  | Gateway hors ligne | Réessayer dans quelques minutes

Erreurs SDK :
FayaPayAuthError
FayaPayValidationError
FayaPayNotFoundError
FayaPayDuplicateError
FayaPayNetworkError
FayaPayGatewayUnavailableError
```

---

## 5. Composants interactifs

### RequestExample.tsx
```tsx
// Affiche curl ET SDK côte à côte avec tabs
// Tab 1 : curl
// Tab 2 : Node.js SDK
// Tab 3 : HTTP raw

<RequestExample
  curl={`curl -X POST https://api.fayapay.app/v1/transactions \\
  -H "Authorization: Bearer faya_live_xxx" \\
  -d '{"reference":"order_123","amount":5000}'`}
  sdk={`const tx = await faya.transactions.initiate({
  reference: 'order_123',
  amount: 5000
})`}
/>
```

### EndpointHeader.tsx
```tsx
// Affiche méthode HTTP + path avec couleur
<EndpointHeader method="POST" path="/v1/transactions" />
// → Badge vert POST + /v1/transactions
```

### ParamTable.tsx
```tsx
// Tableau paramètres avec nom, type, requis, description
<ParamTable params={[
  { name: 'reference', type: 'string', required: true, description: '...' },
  { name: 'amount', type: 'integer', required: true, description: '...' },
]} />
```

---

## 6. Configuration Nextra (`theme.config.tsx`)

```tsx
export default {
  logo: <span>⚡ FayaPay</span>,
  project: { link: 'https://github.com/fayapay' },
  docsRepositoryBase: 'https://github.com/fayapay/faya-docs',
  footer: { text: '© 2024 FayaPay — Infrastructure de paiement CEMAC' },
  primaryHue: 24,        // Orange FayaPay
  navigation: true,
  search: { placeholder: 'Rechercher dans la documentation...' },
  sidebar: { defaultMenuCollapseLevel: 1 },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Documentation FayaPay — API de paiement Mobile Money pour le Tchad" />
    </>
  )
}
```

---

## 7. Variables d'environnement

```env
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.fayapay.app
NEXT_PUBLIC_API_URL=https://api.fayapay.app
```

---

## 8. Règles critiques pour Cursor

1. **Langue française obligatoire** — toute la documentation en français
2. **Exemples de code complets** — jamais de `// ... reste du code`
3. **Toujours montrer curl ET SDK** — le merchant choisit son approche
4. **Montants toujours en XAF entiers** — jamais de float dans les exemples
5. **Numéros tchadiens dans les exemples** — format +235XXXXXXXX
6. **Avertissement sécurité sur chaque exemple** — ne jamais exposer la clé API côté client
7. **Nextra 3 uniquement** — pas Docusaurus, pas VitePress
8. **Zéro contenu fictif** — tous les exemples doivent être fonctionnels
9. **Page erreurs exhaustive** — chaque code d'erreur avec sa solution concrète
10. **Navigation claire** — un développeur trouve ce qu'il cherche en 2 clics maximum
