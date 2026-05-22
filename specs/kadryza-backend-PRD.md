# PRD — kadryza-backend
> Document de référence pour Cursor. Lire entièrement avant de générer du code.

---

## 1. Contexte du projet

**Kadryza Pay** est une infrastructure de paiement Mobile Money pour le Tchad et la zone CEMAC.
En l'absence d'API publiques des opérateurs locaux (Airtel Money, Moov Money), Kadryza Pay utilise
un device Android physique ("Gateway") comme intermédiaire : il exécute les sessions USSD et
intercepte les SMS de confirmation des opérateurs.

`kadryza-backend` est le cerveau central du système. Il :
- Expose une API REST aux merchants (sites e-commerce, apps)
- Communique en temps réel avec le Gateway Android via WebSocket
- Orchestre le cycle de vie complet des transactions
- Dispatche les webhooks de confirmation aux merchants

---

## 2. Stack technique

| Couche | Technologie | Version cible |
|---|---|---|
| Language | Go | 1.22+ |
| Framework Web | Fiber | v2 |
| WebSocket | Gorilla WebSocket | v1.5 |
| ORM / Queries | sqlc + pgx/v5 | latest |
| Queue / Jobs | Asynq | v0.24 |
| Cache | Redis | 7.x |
| Base de données | PostgreSQL | 16.x |
| Auth | golang-jwt/jwt | v5 |
| Config | Viper | v1 |
| Logs | Uber Zap | v1 |
| Tests | testify | v1 |
| Deploy | VPS Ubuntu 24.04 (systemd) | — |
| Reverse Proxy | Caddy | v2 |

---

## 3. Structure des dossiers

```
kadryza-backend/
├── cmd/
│   └── server/
│       └── main.go                  # Point d'entrée
├── internal/
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── auth.go              # Validation JWT + API Key
│   │   │   ├── ratelimit.go         # Rate limiting Redis
│   │   │   └── logger.go            # Request logging
│   │   ├── handlers/
│   │   │   ├── transactions.go      # Handlers transactions
│   │   │   ├── merchants.go         # Handlers merchants
│   │   │   ├── webhooks.go          # Handlers config webhooks
│   │   │   └── gateway.go           # Handlers admin gateway
│   │   └── router.go                # Déclaration des routes Fiber
│   ├── gateway/
│   │   ├── hub.go                   # WebSocket Hub (gère les connexions gateway)
│   │   ├── client.go                # WebSocket Client (une instance gateway)
│   │   └── protocol.go              # Types des messages WS gateway ↔ backend
│   ├── services/
│   │   ├── transaction_service.go   # Logique métier transactions
│   │   ├── merchant_service.go      # Logique métier merchants
│   │   └── webhook_service.go       # Dispatch webhooks + retry
│   ├── workers/
│   │   ├── webhook_worker.go        # Worker Asynq : envoi webhooks
│   │   ├── timeout_worker.go        # Worker Asynq : expire transactions pending
│   │   └── scheduler.go             # Enregistrement des workers
│   ├── db/
│   │   ├── queries/                 # Fichiers .sql pour sqlc
│   │   │   ├── transactions.sql
│   │   │   ├── merchants.sql
│   │   │   └── webhooks.sql
│   │   ├── migrations/              # Fichiers SQL de migration (numérotés)
│   │   │   ├── 001_create_merchants.sql
│   │   │   ├── 002_create_transactions.sql
│   │   │   ├── 003_create_webhook_endpoints.sql
│   │   │   └── 004_create_audit_logs.sql
│   │   └── sqlc/                    # Code généré par sqlc (ne pas éditer manuellement)
│   ├── models/
│   │   ├── transaction.go           # Structs + enums métier
│   │   ├── merchant.go
│   │   └── webhook.go
│   └── config/
│       └── config.go                # Chargement config via Viper
├── pkg/
│   └── crypto/
│       └── apikey.go                # Génération + hashing des API keys
├── sqlc.yaml                        # Config sqlc
├── .env.example
├── Makefile
├── Caddyfile
└── README.md
```

---

## 4. Modèles de données (PostgreSQL)

### Table `merchants`
```sql
CREATE TABLE merchants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key_hash  VARCHAR(255) UNIQUE,          -- Hash SHA-256 de la clé API
    api_key_prefix VARCHAR(10),                  -- Ex: "kadryza_live_" pour affichage
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Table `transactions`
```sql
CREATE TYPE transaction_status AS ENUM (
    'PENDING',      -- Créée, en attente d'exécution gateway
    'PROCESSING',   -- Gateway en train d'exécuter USSD
    'WAITING_SMS',  -- USSD envoyé, attente confirmation SMS opérateur
    'SUCCESS',      -- SMS de confirmation reçu et parsé
    'FAILED',       -- Échec USSD ou SMS négatif
    'TIMEOUT',      -- Pas de réponse dans le délai imparti
    'REFUNDED'      -- Remboursée (manuel pour l'instant)
);

CREATE TYPE operator_type AS ENUM ('AIRTEL', 'MOOV');
CREATE TYPE currency_type AS ENUM ('XAF');

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    reference       VARCHAR(100) UNIQUE NOT NULL,  -- Référence merchant (idempotency)
    internal_ref    VARCHAR(100) UNIQUE NOT NULL,  -- Référence interne Kadryza
    amount          BIGINT NOT NULL,               -- Montant en centimes XAF
    currency        currency_type DEFAULT 'XAF',
    operator        operator_type NOT NULL,
    phone_number    VARCHAR(20) NOT NULL,           -- Numéro du payeur
    description     VARCHAR(255),
    status          transaction_status DEFAULT 'PENDING',
    gateway_id      VARCHAR(100),                  -- ID du device gateway utilisé
    ussd_session_id VARCHAR(100),                  -- ID session USSD si disponible
    sms_raw         TEXT,                          -- SMS brut reçu (audit)
    failure_reason  VARCHAR(255),
    webhook_sent    BOOLEAN DEFAULT false,
    webhook_attempts INT DEFAULT 0,
    initiated_at    TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_expires ON transactions(expires_at) WHERE status = 'PENDING';
```

### Table `webhook_endpoints`
```sql
CREATE TABLE webhook_endpoints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    url         VARCHAR(500) NOT NULL,
    secret      VARCHAR(255) NOT NULL,   -- Pour signer les payloads
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Table `audit_logs`
```sql
CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    merchant_id    UUID REFERENCES merchants(id),
    event_type     VARCHAR(100) NOT NULL,  -- Ex: "TRANSACTION_INITIATED", "SMS_RECEIVED"
    payload        JSONB,                  -- Données brutes de l'événement
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API REST — Endpoints

### Auth merchants
```
POST   /v1/auth/register          Inscription merchant
POST   /v1/auth/login             Connexion → JWT
POST   /v1/auth/api-keys          Générer une API key
DELETE /v1/auth/api-keys/:id      Révoquer une API key
```

### Transactions (authentification par API Key)
```
POST   /v1/transactions           Initier une transaction
GET    /v1/transactions/:id       Récupérer le statut d'une transaction
GET    /v1/transactions           Lister les transactions (paginé, filtrable)
```

### Webhooks
```
POST   /v1/webhooks               Créer un endpoint webhook
GET    /v1/webhooks               Lister les endpoints
DELETE /v1/webhooks/:id           Supprimer un endpoint
POST   /v1/webhooks/:id/test      Tester un endpoint (envoie payload fictif)
```

### Gateway (authentification par token gateway signé)
```
GET    /v1/gateway/ws             Upgrade WebSocket — connexion gateway Android
GET    /v1/gateway/status         Statut des gateways connectés (admin)
```

### Santé
```
GET    /health                    Liveness check
GET    /ready                     Readiness check (DB + Redis connectés)
```

---

## 6. Payload des endpoints critiques

### POST /v1/transactions
**Request:**
```json
{
  "reference": "order_123",
  "amount": 5000,
  "currency": "XAF",
  "operator": "AIRTEL",
  "phone_number": "+23566xxxxxxx",
  "description": "Paiement commande #123"
}
```

**Response 201:**
```json
{
  "id": "uuid-de-la-transaction",
  "internal_ref": "KADRYZA-20240115-XXXX",
  "status": "PENDING",
  "expires_at": "2024-01-15T10:05:00Z"
}
```

### GET /v1/transactions/:id
**Response 200:**
```json
{
  "id": "uuid",
  "reference": "order_123",
  "internal_ref": "KADRYZA-20240115-XXXX",
  "amount": 5000,
  "currency": "XAF",
  "operator": "AIRTEL",
  "phone_number": "+23566xxxxxxx",
  "status": "SUCCESS",
  "confirmed_at": "2024-01-15T10:02:30Z",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

## 7. Protocole WebSocket Gateway ↔ Backend

Tous les messages sont en JSON. Chaque message a un champ `type`.

### Backend → Gateway (instructions)
```json
// Demander au gateway d'initier un paiement USSD
{
  "type": "INITIATE_PAYMENT",
  "transaction_id": "uuid",
  "amount": 5000,
  "phone_number": "+23566xxxxxxx",
  "operator": "AIRTEL"
}

// Demander un heartbeat immédiat
{
  "type": "PING"
}
```

### Gateway → Backend (rapports)
```json
// Confirmation qu'une instruction a été reçue
{
  "type": "ACK",
  "transaction_id": "uuid"
}

// USSD lancé avec succès
{
  "type": "USSD_STARTED",
  "transaction_id": "uuid"
}

// SMS de confirmation reçu et parsé
{
  "type": "SMS_RECEIVED",
  "transaction_id": "uuid",
  "sms_raw": "Vous avez recu 5000 FCFA de +23566xxxxxxx. Ref: ABC123",
  "parsed": {
    "amount": 5000,
    "sender": "+23566xxxxxxx",
    "reference": "ABC123",
    "success": true
  }
}

// Échec de l'opération
{
  "type": "OPERATION_FAILED",
  "transaction_id": "uuid",
  "reason": "USSD_TIMEOUT"
}

// Heartbeat
{
  "type": "PONG",
  "gateway_id": "device-uuid",
  "sim_status": {
    "AIRTEL": "ACTIVE",
    "MOOV": "ACTIVE"
  }
}
```

---

## 8. Payload Webhook vers Merchant

Envoyé en POST vers l'URL configurée. Signé avec HMAC-SHA256.

```json
{
  "event": "transaction.success",
  "data": {
    "id": "uuid",
    "reference": "order_123",
    "amount": 5000,
    "currency": "XAF",
    "operator": "AIRTEL",
    "phone_number": "+23566xxxxxxx",
    "status": "SUCCESS",
    "confirmed_at": "2024-01-15T10:02:30Z"
  },
  "timestamp": "2024-01-15T10:02:31Z"
}
```

**Header de signature :**
```
X-Kadryza-Signature: sha256=<hmac_hex>
```

---

## 9. Règles métier critiques

1. **Idempotence** : Si un merchant envoie deux fois le même `reference`, retourner la transaction existante sans créer de doublon.

2. **Timeout automatique** : Toute transaction en statut `PENDING` ou `PROCESSING` depuis plus de 5 minutes passe automatiquement en `TIMEOUT` via un worker Asynq.

3. **Retry webhooks** : Si le webhook échoue (HTTP non-2xx ou timeout), retry avec backoff exponentiel : 1min, 5min, 30min, 2h. Max 4 tentatives.

4. **Un seul gateway actif par opérateur** : Le Hub WebSocket doit maintenir une map `operator → gateway_client`. Si un nouveau gateway se connecte pour le même opérateur, l'ancien est déconnecté proprement.

5. **Heartbeat gateway** : Si un gateway ne répond pas au PING dans 60 secondes, le marquer comme `DISCONNECTED` et faire passer les transactions `PROCESSING` associées en `FAILED`.

6. **Audit log immuable** : Chaque changement de statut d'une transaction doit créer une entrée dans `audit_logs`. Jamais de UPDATE sans INSERT dans audit_logs.

7. **Montants en entiers** : Tous les montants sont stockés et transmis en entiers (centimes XAF). Jamais de float.

8. **API Key hashée** : L'API key n'est jamais stockée en clair. Stocker uniquement le hash SHA-256. La clé complète n'est affichée qu'une seule fois à la création.

---

## 10. Variables d'environnement (.env)

```env
# Serveur
PORT=8080
ENV=production

# PostgreSQL
DATABASE_URL=postgres://kadryza:password@localhost:5432/kadryza?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<secret_long_random>
JWT_EXPIRY=24h

# Gateway WebSocket
GATEWAY_TOKEN_SECRET=<secret_long_random>

# Webhook
WEBHOOK_TIMEOUT_SECONDS=10

# Transaction
TRANSACTION_TIMEOUT_MINUTES=5
```

---

## 11. Makefile (commandes importantes)

```makefile
run:
	go run ./cmd/server

build:
	go build -o bin/kadryza-backend ./cmd/server

migrate:
	# Appliquer les migrations SQL dans l'ordre
	psql $(DATABASE_URL) -f internal/db/migrations/001_create_merchants.sql
	# etc.

sqlc:
	sqlc generate

test:
	go test ./... -v

lint:
	golangci-lint run
```

---

## 12. Notes importantes pour Cursor

- Ne jamais utiliser `database/sql` directement — utiliser `pgx/v5` via `sqlc`
- Ne jamais stocker de données sensibles (API keys, mots de passe) en clair
- Tous les handlers doivent retourner des erreurs structurées JSON : `{"error": "message", "code": "ERROR_CODE"}`
- Le WebSocket Hub doit être thread-safe (utiliser des channels Go, pas des mutex sur les maps)
- Les workers Asynq tournent dans le même binaire mais dans des goroutines séparées
- Utiliser `context.Context` partout pour propager les annulations et timeouts
- Toute logique métier dans `services/`, les handlers sont de simples relais
- Les logs doivent être structurés (JSON en prod, human-readable en dev) via Zap
