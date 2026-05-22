# Kadryza

> Infrastructure de paiement Mobile Money pour le Tchad et la zone CEMAC.

Kadryza est une passerelle de paiement qui utilise un device Android physique (Gateway) comme intermédiaire pour exécuter les sessions USSD et intercepter les SMS de confirmation des opérateurs (Airtel Money, Moov Money).

```
Merchant → API/SDK → kadryza-backend → WebSocket → Gateway Android → USSD/SMS → Opérateur
```

---

## Composants

| Composant | Dossier | Stack | Description |
|-----------|---------|-------|-------------|
| **Backend** | `/` (racine) | Go 1.22, Fiber, PostgreSQL, Redis | API REST, WebSocket, workers Asynq |
| **Dashboard** | `kadryza-dashboard/` | Next.js 14, React 18, Tailwind | Interface merchant pour gérer les transactions |
| **SDK** | `kadryza-sdk/` | TypeScript, tsup | SDK Node.js (`@kadryza/sdk`) pour les marchands |
| **Documentation** | `kadryza-docs/` | Nextra 3 (Next.js) | Documentation publique (docs.kadryza.app) |
| **Gateway** | `kadryza-gateway/` | Android (Kotlin), Koin | App Android qui exécute les USSD et intercepte les SMS |

---

## Architecture

```
┌─────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Merchant   │     │  kadryza-backend   │     │ kadryza-gateway  │
│  (SDK/API)  │────▶│  (Go + Fiber)      │────▶│  (Android)       │
│             │     │  PostgreSQL + Redis │ WS  │  USSD + SMS      │
└─────────────┘     └────────────────────┘     └──────────────────┘
                           │                          │
                    ┌──────┴──────┐              ┌────┴────┐
                    │  Webhooks   │              │ Airtel  │
                    │  → Merchant │              │ Moov    │
                    └─────────────┘              └─────────┘
```

---

## Démarrage rapide

### Backend (Go)

```bash
# 1. Copier et configurer l'environnement
cp .env.example .env

# 2. Démarrer PostgreSQL et Redis (ou utiliser Docker)
# 3. Créer la base de données
createdb kadryza

# 4. Appliquer les migrations
make migrate

# 5. Générer le code sqlc (obligatoire avant le premier build)
make sqlc

# 6. Lancer le serveur
make run
```

### Dashboard

```bash
cd kadryza-dashboard
cp .env.local.example .env.local
npm install
npm run dev
```

### Documentation

```bash
cd kadryza-docs
cp .env.local.example .env.local
npm install
npm run dev
```

### SDK (développement)

```bash
cd kadryza-sdk
npm install
npm run dev       # watch mode
npm run test      # tests
```

---

## Commandes utiles (Backend)

| Commande      | Description                        |
|---------------|--------------------------------------|
| `make run`    | Lancer le serveur en dev           |
| `make build`  | Compiler le binaire de production  |
| `make migrate`| Appliquer les migrations SQL       |
| `make sqlc`   | Générer le code depuis les queries |
| `make test`   | Lancer les tests                   |
| `make lint`   | Lancer le linter                   |

---

## URLs

| Service | URL |
|---------|-----|
| API | `https://api.kadryza.app` |
| Dashboard | `https://dashboard.kadryza.app` |
| Documentation | `https://docs.kadryza.app` |
| Support | `support@kadryza.app` |

---

## Licence

Propriétaire — Tous droits réservés.
