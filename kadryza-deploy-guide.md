# Guide de Déploiement — Kadryza
> Document pour les agents Cursor.
> Exécuter dans l'ordre exact. Ne pas sauter d'étape.
> Domaine de test : spencerai.tech
> Serveur : VPS Hostinger Ubuntu 24.04

---

## Architecture de déploiement

```
Internet
    │
    ▼
Caddy (reverse proxy + HTTPS auto)
    │
    ├── api.spencerai.tech        → kadryza-backend (Go :8080)
    ├── dashboard.spencerai.tech  → kadryza-dashboard (Next.js :3000)
    └── docs.spencerai.tech       → kadryza-docs (Next.js :3001)

Docker Compose (services internes) :
    ├── PostgreSQL 16  (:5432)
    └── Redis 7        (:6379)

Systemd (services Go + Next.js) :
    ├── kadryza-backend.service
    ├── kadryza-dashboard.service
    └── kadryza-docs.service
```

---

## Prérequis DNS (à faire AVANT de déployer)

Sur le registrar de spencerai.tech, ajouter 3 entrées A :

```
api.spencerai.tech        →  IP_DE_TON_VPS
dashboard.spencerai.tech  →  IP_DE_TON_VPS
docs.spencerai.tech       →  IP_DE_TON_VPS
```

Attendre la propagation DNS (5-30 minutes) avant de continuer.

---

## Étape 1 — Préparer le VPS

Se connecter en SSH puis exécuter :

```bash
# Mise à jour système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances de base
sudo apt install -y curl git wget unzip build-essential

# Installer Go 1.22
wget https://go.dev/dl/go1.22.3.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.3.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version  # doit afficher go1.22.3

# Installer Node.js 20 (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version  # doit afficher v20.x.x

# Installer Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version

# Installer Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
caddy version

# Installer sqlc
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
source ~/.bashrc
sqlc version
```

---

## Étape 2 — Cloner le projet

```bash
# Créer le dossier de travail
sudo mkdir -p /opt/kadryza
sudo chown $USER:$USER /opt/kadryza
cd /opt/kadryza

# Cloner le monorepo
git clone https://github.com/TON_USERNAME/kadryza.git .

# Vérifier la structure
ls -la
# Doit afficher : kadryza-backend/ kadryza-gateway/ 
#                 kadryza-dashboard/ kadryza-sdk/ kadryza-docs/
```

---

## Étape 3 — Docker Compose (PostgreSQL + Redis)

Créer le fichier à la racine du monorepo :

```yaml
# /opt/kadryza/docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: kadryza-postgres
    restart: always
    environment:
      POSTGRES_DB: kadryza
      POSTGRES_USER: kadryza
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"  # Localhost uniquement, jamais exposé

  redis:
    image: redis:7-alpine
    container_name: kadryza-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # Localhost uniquement

volumes:
  postgres_data:
  redis_data:
```

Créer le fichier `.env` Docker :

```bash
# /opt/kadryza/.env
POSTGRES_PASSWORD=CHANGE_MOI_MOT_DE_PASSE_FORT_32_CHARS
REDIS_PASSWORD=CHANGE_MOI_MOT_DE_PASSE_FORT_32_CHARS
```

Démarrer les services :

```bash
cd /opt/kadryza
docker compose up -d
docker compose ps  # postgres et redis doivent être "running"

# Vérifier PostgreSQL
docker exec -it kadryza-postgres psql -U kadryza -d kadryza -c "SELECT version();"

# Vérifier Redis
docker exec -it kadryza-redis redis-cli -a TON_REDIS_PASSWORD ping
# Doit répondre : PONG
```

---

## Étape 4 — Backend Kadryza (Go)

### 4.1 Variables d'environnement

```bash
# /opt/kadryza/kadryza-backend/.env
PORT=8080
ENV=production

# PostgreSQL
DATABASE_URL=postgres://kadryza:TON_POSTGRES_PASSWORD@localhost:5432/kadryza?sslmode=disable

# Redis
REDIS_URL=redis://:TON_REDIS_PASSWORD@localhost:6379

# JWT (générer avec : openssl rand -hex 32)
JWT_SECRET=GENERER_AVEC_OPENSSL_RAND_HEX_32
JWT_EXPIRY=24h

# Gateway WebSocket
GATEWAY_TOKEN_SECRET=GENERER_AVEC_OPENSSL_RAND_HEX_32

# CORS
CORS_ORIGINS=https://dashboard.spencerai.tech

# Webhook
WEBHOOK_TIMEOUT_SECONDS=10

# Transaction
TRANSACTION_TIMEOUT_MINUTES=5
```

### 4.2 Migrations + Build

```bash
cd /opt/kadryza/kadryza-backend

# Installer les dépendances Go
go mod tidy

# Générer le code sqlc
sqlc generate

# Appliquer les migrations dans l'ordre
export DATABASE_URL="postgres://kadryza:TON_POSTGRES_PASSWORD@localhost:5432/kadryza?sslmode=disable"

psql $DATABASE_URL -f internal/db/migrations/001_create_merchants.sql
psql $DATABASE_URL -f internal/db/migrations/002_create_transactions.sql
psql $DATABASE_URL -f internal/db/migrations/003_create_webhook_endpoints.sql
psql $DATABASE_URL -f internal/db/migrations/004_create_audit_logs.sql

# Vérifier les tables
psql $DATABASE_URL -c "\dt"
# Doit afficher : merchants, transactions, webhook_endpoints, audit_logs

# Compiler le binaire
go build -o bin/kadryza-backend ./cmd/server
ls -la bin/  # doit afficher kadryza-backend
```

### 4.3 Service systemd

```bash
# Créer le service
sudo tee /etc/systemd/system/kadryza-backend.service << 'EOF'
[Unit]
Description=Kadryza Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/kadryza/kadryza-backend
EnvironmentFile=/opt/kadryza/kadryza-backend/.env
ExecStart=/opt/kadryza/kadryza-backend/bin/kadryza-backend
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Remplacer YOUR_USERNAME par ton vrai username
sudo sed -i 's/YOUR_USERNAME/'$USER'/g' /etc/systemd/system/kadryza-backend.service

# Démarrer le service
sudo systemctl daemon-reload
sudo systemctl enable kadryza-backend
sudo systemctl start kadryza-backend
sudo systemctl status kadryza-backend

# Vérifier que le backend répond
curl http://localhost:8080/health
# Doit répondre : {"status":"ok"}
```

---

## Étape 5 — Dashboard (Next.js)

```bash
cd /opt/kadryza/kadryza-dashboard

# Créer le .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.spencerai.tech
NEXT_PUBLIC_APP_NAME=Kadryza
EOF

# IMPORTANT : initialiser shadcn/ui avant le build
npx shadcn-ui@latest init --yes --defaults

# Installer les dépendances
npm install

# Build production
npm run build

# Installer PM2 pour gérer le process Node
npm install -g pm2

# Démarrer le dashboard
pm2 start npm --name "kadryza-dashboard" -- start -- -p 3000
pm2 save
pm2 startup  # suivre les instructions affichées

# Vérifier
curl http://localhost:3000
```

---

## Étape 6 — Documentation (Nextra)

```bash
cd /opt/kadryza/kadryza-docs

# Créer le .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.spencerai.tech
NEXT_PUBLIC_API_URL=https://api.spencerai.tech
EOF

# Installer les dépendances
npm install

# Build production
npm run build

# Démarrer avec PM2
pm2 start npm --name "kadryza-docs" -- start -- -p 3001
pm2 save

# Vérifier
curl http://localhost:3001
```

---

## Étape 7 — Caddy (Reverse Proxy + HTTPS)

```bash
# Créer le Caddyfile
sudo tee /etc/caddy/Caddyfile << 'EOF'
# API Backend
api.spencerai.tech {
    reverse_proxy localhost:8080

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }

    log {
        output file /var/log/caddy/api.log
        format json
    }
}

# Dashboard Merchant
dashboard.spencerai.tech {
    reverse_proxy localhost:3000

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    log {
        output file /var/log/caddy/dashboard.log
        format json
    }
}

# Documentation
docs.spencerai.tech {
    reverse_proxy localhost:3001

    log {
        output file /var/log/caddy/docs.log
        format json
    }
}
EOF

# Créer le dossier logs
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# Valider la config Caddy
sudo caddy validate --config /etc/caddy/Caddyfile

# Recharger Caddy
sudo systemctl reload caddy
sudo systemctl status caddy
```

---

## Étape 8 — Smoke Tests

Vérifier que tout fonctionne :

```bash
# 1. Health check backend
curl https://api.spencerai.tech/health
# Attendu : {"status":"ok"}

# 2. Readiness check (DB + Redis)
curl https://api.spencerai.tech/ready
# Attendu : {"status":"ready","postgres":"ok","redis":"ok"}

# 3. Dashboard accessible
curl -I https://dashboard.spencerai.tech
# Attendu : HTTP/2 200

# 4. Docs accessible
curl -I https://docs.spencerai.tech
# Attendu : HTTP/2 200

# 5. Test inscription merchant
curl -X POST https://api.spencerai.tech/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Merchant",
    "email": "test@kadryza.app",
    "password": "TestPassword123!"
  }'
# Attendu : {"id":"...","email":"test@kadryza.app"}

# 6. Test login
curl -X POST https://api.spencerai.tech/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@kadryza.app",
    "password": "TestPassword123!"
  }'
# Attendu : {"token":"eyJ..."}
```

---

## Étape 9 — Script de mise à jour

Créer un script pour les futurs déploiements :

```bash
# /opt/kadryza/deploy.sh
#!/bin/bash

set -e

echo "🚀 Déploiement Kadryza..."

cd /opt/kadryza

# Pull dernières modifications
git pull origin main

# Backend
echo "📦 Build backend..."
cd kadryza-backend
go mod tidy
sqlc generate
go build -o bin/kadryza-backend ./cmd/server
sudo systemctl restart kadryza-backend
echo "✅ Backend redémarré"

# Dashboard
echo "📦 Build dashboard..."
cd ../kadryza-dashboard
npm install
npm run build
pm2 restart kadryza-dashboard
echo "✅ Dashboard redémarré"

# Docs
echo "📦 Build docs..."
cd ../kadryza-docs
npm install
npm run build
pm2 restart kadryza-docs
echo "✅ Docs redémarrées"

echo "🎉 Déploiement terminé !"

# Smoke tests rapides
sleep 3
curl -f https://api.spencerai.tech/health && echo "✅ API OK"
curl -f -I https://dashboard.spencerai.tech && echo "✅ Dashboard OK"
```

```bash
# Rendre le script exécutable
chmod +x /opt/kadryza/deploy.sh
```

---

## Commandes utiles

```bash
# Voir les logs backend
sudo journalctl -u kadryza-backend -f

# Voir les logs dashboard
pm2 logs kadryza-dashboard

# Voir les logs Caddy
sudo tail -f /var/log/caddy/api.log

# Redémarrer un service
sudo systemctl restart kadryza-backend
pm2 restart kadryza-dashboard
pm2 restart kadryza-docs

# Statut de tous les services
sudo systemctl status kadryza-backend
pm2 status
docker compose ps

# Backup base de données
docker exec kadryza-postgres pg_dump -U kadryza kadryza > backup_$(date +%Y%m%d).sql
```

---

## En cas de problème

```bash
# Backend ne démarre pas
sudo journalctl -u kadryza-backend -n 50
# Vérifier : .env correct ? PostgreSQL accessible ? Port 8080 libre ?

# Dashboard ne charge pas
pm2 logs kadryza-dashboard --lines 50
# Vérifier : npm run build réussi ? Port 3000 libre ?

# Caddy HTTPS ne fonctionne pas
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl status caddy
# Vérifier : DNS propagé ? Port 80/443 ouvert sur le firewall ?

# PostgreSQL inaccessible
docker compose logs postgres
docker compose restart postgres

# Vérifier les ports ouverts
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
```
