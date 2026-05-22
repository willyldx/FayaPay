# PRD — kadryza-dashboard
> Document de référence pour Cursor. Lire entièrement avant de générer du code.
> Ce projet fait partie du monorepo `kadryza/kadryza-dashboard/`

---

## 1. Contexte du projet

`kadryza-dashboard` est l'interface web B2B de Kadryza. C'est ce que voient
les merchants après inscription — leur espace de gestion complet.

Il consomme exclusivement l'API REST de `kadryza-backend`.
Aucune logique métier ici — uniquement de la présentation et de l'interaction.

**Utilisateurs cibles :** Développeurs et propriétaires de business
qui ont intégré Kadryza dans leur plateforme.

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js | 14 (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | latest |
| Charts & Metrics | Tremor | 3.x |
| State global | Zustand | 4.x |
| Data fetching | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | latest |
| Auth | JWT stocké en httpOnly cookie | — |
| Icons | Lucide React | latest |
| Notifications | Sonner (toasts) | latest |
| Deploy | Vercel ou VPS Caddy | — |

---

## 3. Structure des dossiers

```
kadryza-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Page de connexion
│   │   └── register/
│   │       └── page.tsx              # Page d'inscription
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Layout dashboard (sidebar + header)
│   │   ├── page.tsx                  # Vue d'ensemble (overview)
│   │   ├── transactions/
│   │   │   ├── page.tsx              # Liste des transactions
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Détail d'une transaction
│   │   ├── api-keys/
│   │   │   └── page.tsx              # Gestion des clés API
│   │   └── webhooks/
│   │       └── page.tsx              # Gestion des webhooks
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Styles globaux Tailwind
├── components/
│   ├── ui/                           # Composants shadcn/ui (auto-générés)
│   ├── layout/
│   │   ├── Sidebar.tsx               # Navigation latérale
│   │   ├── Header.tsx                # Header avec profil merchant
│   │   └── MobileNav.tsx             # Navigation mobile
│   ├── dashboard/
│   │   ├── StatsCards.tsx            # Cartes métriques (volume, nb tx, taux succès)
│   │   ├── TransactionChart.tsx      # Graphique volume transactions (Tremor)
│   │   ├── OperatorPieChart.tsx      # Répartition Airtel vs Moov (Tremor)
│   │   ├── RecentTransactions.tsx    # Tableau 10 dernières transactions
│   │   └── GatewayStatus.tsx        # Statut gateway en temps réel
│   ├── transactions/
│   │   ├── TransactionTable.tsx      # Table paginée + filtres
│   │   ├── TransactionFilters.tsx    # Filtres : statut, opérateur, date
│   │   ├── TransactionBadge.tsx      # Badge coloré par statut
│   │   └── TransactionDetail.tsx     # Modal détail transaction
│   ├── api-keys/
│   │   ├── ApiKeyCard.tsx            # Carte affichage clé API
│   │   ├── CreateApiKeyModal.tsx     # Modal création clé
│   │   └── RevokeKeyDialog.tsx       # Dialog confirmation révocation
│   └── webhooks/
│       ├── WebhookCard.tsx           # Carte endpoint webhook
│       ├── CreateWebhookModal.tsx    # Modal création webhook
│       └── TestWebhookButton.tsx     # Bouton test avec résultat
├── lib/
│   ├── api/
│   │   ├── client.ts                 # Client HTTP central (fetch wrapper)
│   │   ├── transactions.ts           # Fonctions API transactions
│   │   ├── merchants.ts              # Fonctions API auth + profil
│   │   ├── webhooks.ts               # Fonctions API webhooks
│   │   └── api-keys.ts               # Fonctions API keys
│   ├── auth/
│   │   └── session.ts                # Lecture/écriture JWT cookie
│   ├── hooks/
│   │   ├── useTransactions.ts        # TanStack Query : transactions
│   │   ├── useWebhooks.ts            # TanStack Query : webhooks
│   │   ├── useApiKeys.ts             # TanStack Query : api keys
│   │   └── useDashboardStats.ts      # TanStack Query : métriques overview
│   ├── stores/
│   │   └── authStore.ts              # Zustand : état auth merchant
│   ├── types/
│   │   └── index.ts                  # Types TypeScript (Transaction, Merchant...)
│   └── utils/
│       ├── format.ts                 # Formatage montants XAF, dates
│       └── validators.ts             # Schémas Zod
├── middleware.ts                     # Protection routes dashboard (JWT check)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.local.example
```

---

## 4. Pages et fonctionnalités

### 4.1 Page Login (`/login`)

```
- Formulaire : email + mot de passe
- Validation Zod côté client
- POST /v1/auth/login → stocker JWT en httpOnly cookie
- Redirect vers /dashboard après succès
- Lien vers /register
- Gestion erreurs : identifiants invalides, compte inactif
```

### 4.2 Page Register (`/register`)

```
- Formulaire : nom entreprise + email + mot de passe + confirmation
- Validation Zod (mot de passe min 8 chars, email valide)
- POST /v1/auth/register
- Redirect vers /login après succès avec message de confirmation
```

### 4.3 Dashboard Overview (`/`)

```
Métriques en temps réel (refresh toutes les 30s) :

┌─────────────────────────────────────────────────────┐
│  Volume total (XAF)  │  Nb transactions  │  Taux succès  │
│  12,450,000 XAF      │  248              │  94.7%        │
└─────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────┐
│  Graphique volume 7 jours│  │  Airtel vs Moov      │
│  (Tremor AreaChart)      │  │  (Tremor DonutChart) │
└──────────────────────────┘  └──────────────────────┘

┌─────────────────────────────────────────────────────┐
│  10 dernières transactions                          │
│  (tableau avec statut coloré)                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Statut Gateway                                     │
│  ● Connecté  │  Airtel ✓  │  Moov ✓                │
└─────────────────────────────────────────────────────┘
```

### 4.4 Transactions (`/transactions`)

```
- Table paginée (20 par page)
- Colonnes : référence, montant, opérateur, téléphone, statut, date
- Filtres :
    → Statut (PENDING, SUCCESS, FAILED, TIMEOUT)
    → Opérateur (AIRTEL, MOOV)
    → Période (aujourd'hui, 7j, 30j, custom)
- Recherche par référence
- Click sur une ligne → drawer latéral avec détail complet
- Export CSV (côté client, données déjà chargées)
```

### 4.5 API Keys (`/api-keys`)

```
- Liste des clés actives avec préfixe visible (kadryza_live_xxxx...)
- Date de création
- Bouton "Créer une clé" → modal
    → La clé complète s'affiche UNE SEULE FOIS
    → Message d'avertissement explicite
    → Bouton copier
- Bouton "Révoquer" → dialog de confirmation
```

### 4.6 Webhooks (`/webhooks`)

```
- Liste des endpoints configurés
- Pour chaque endpoint : URL, statut actif/inactif, date création
- Bouton "Ajouter un endpoint" → modal
    → Champ URL
    → Affichage du secret généré UNE SEULE FOIS
- Bouton "Tester" → envoie payload fictif → affiche résultat HTTP
- Bouton "Supprimer" → dialog confirmation
```

---

## 5. Types TypeScript (`lib/types/index.ts`)

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

export interface Transaction {
  id: string
  reference: string
  internal_ref: string
  amount: number              // En entiers XAF
  currency: 'XAF'
  operator: OperatorType
  phone_number: string
  description?: string
  status: TransactionStatus
  failure_reason?: string
  webhook_sent: boolean
  initiated_at: string        // ISO 8601
  confirmed_at?: string
  expires_at: string
  created_at: string
}

export interface Merchant {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
}

export interface ApiKey {
  id: string
  prefix: string              // "kadryza_live_xxxx" affiché tronqué
  created_at: string
  // La clé complète n'est retournée qu'à la création
  full_key?: string
}

export interface WebhookEndpoint {
  id: string
  url: string
  is_active: boolean
  created_at: string
  // Le secret n'est retourné qu'à la création
  secret?: string
}

export interface DashboardStats {
  total_volume: number
  total_transactions: number
  success_rate: number
  transactions_by_day: { date: string; volume: number; count: number }[]
  by_operator: { operator: OperatorType; count: number; volume: number }[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

export interface ApiError {
  error: string
  code: string
}
```

---

## 6. Client API (`lib/api/client.ts`)

```typescript
// Wrapper fetch central
// - Ajoute automatiquement le JWT depuis le cookie
// - Gère les erreurs HTTP uniformément
// - Redirige vers /login si 401
// - Base URL depuis variable d'environnement NEXT_PUBLIC_API_URL
```

---

## 7. Middleware Next.js (`middleware.ts`)

```typescript
// Protéger toutes les routes sous /(dashboard)
// Si pas de JWT cookie valide → redirect /login
// Si JWT cookie présent sur /login ou /register → redirect /
```

---

## 8. Formatage (`lib/utils/format.ts`)

```typescript
// formatAmount(5000) → "5 000 XAF"
// formatDate("2024-01-15T10:00:00Z") → "15 jan. 2024, 10:00"
// formatPhone("+23566xxxxxxx") → "+235 66 xx xx xx"
// getStatusColor(status) → className Tailwind par statut
// getStatusLabel(status) → label français par statut
//   PENDING → "En attente"
//   PROCESSING → "En cours"
//   WAITING_SMS → "Attente SMS"
//   SUCCESS → "Réussi"
//   FAILED → "Échoué"
//   TIMEOUT → "Expiré"
//   REFUNDED → "Remboursé"
```

---

## 9. Variables d'environnement (`.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.kadryza.app
NEXT_PUBLIC_APP_NAME=Kadryza
```

---

## 10. Design et UX

```
Palette de couleurs :
- Primaire    : #F97316 (orange — couleur Kadryza)
- Succès      : #22C55E (vert)
- Erreur      : #EF4444 (rouge)
- Warning     : #F59E0B (jaune)
- Neutre      : Slate (gris)
- Background  : #F8FAFC (gris très clair)

Badges statut :
- PENDING     → badge jaune
- PROCESSING  → badge bleu
- WAITING_SMS → badge violet
- SUCCESS     → badge vert
- FAILED      → badge rouge
- TIMEOUT     → badge gris
- REFUNDED    → badge orange

Sidebar :
- Logo Kadryza
- Navigation : Overview, Transactions, API Keys, Webhooks
- En bas : nom merchant + email + bouton déconnexion

Typography :
- Font : Inter (Google Fonts)
- Titres : font-semibold
- Données financières : font-mono (montants, références)
```

---

## 11. Règles critiques pour Cursor

1. **App Router uniquement** — pas de pages/ directory, tout dans app/
2. **Server Components par défaut** — 'use client' uniquement quand nécessaire (interactivité, hooks)
3. **Jamais de logique métier** — le dashboard est un consommateur d'API, pas un moteur
4. **Montants toujours en entiers** — jamais de float, formatage uniquement à l'affichage
5. **JWT en httpOnly cookie** — jamais dans localStorage
6. **TanStack Query pour tout le fetching** — pas de useEffect + fetch manuel
7. **Zod pour toute validation de formulaire** — pas de validation manuelle
8. **Les clés API et secrets webhook s'affichent une seule fois** — message d'avertissement explicite obligatoire
9. **Responsive obligatoire** — le dashboard doit fonctionner sur mobile (merchants africains = mobile first)
10. **Tous les textes en français** — langue principale de l'interface
11. **Gestion d'erreur sur chaque appel API** — toast d'erreur Sonner si échec réseau
12. **Loading states sur chaque composant** — skeleton loaders, jamais d'écran blanc
