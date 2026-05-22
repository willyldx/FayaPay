# Kadryza Backend

> Infrastructure de paiement Mobile Money pour le Tchad et la zone CEMAC.

## Architecture

Kadryza utilise un device Android physique (Gateway) comme intermédiaire pour exécuter les sessions USSD et intercepter les SMS de confirmation des opérateurs (Airtel Money, Moov Money).

```
Merchant API → kadryza-backend → WebSocket → Gateway Android → USSD/SMS → Opérateur
```

## Stack technique

- **Language :** Go 1.22+
- **Framework Web :** Fiber v2
- **WebSocket :** Gorilla WebSocket
- **Base de données :** PostgreSQL 16 (via sqlc + pgx/v5)
- **Cache / Queue :** Redis 7 + Asynq
- **Auth :** JWT (golang-jwt/jwt v5)
- **Config :** Viper
- **Logs :** Uber Zap

## Démarrage rapide

```bash
# 1. Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 2. Créer la base de données
createdb kadryza

# 3. Appliquer les migrations
make migrate

# 4. Générer le code sqlc
make sqlc

# 5. Lancer le serveur
make run
```

## Commandes utiles

| Commande      | Description                        |
|---------------|------------------------------------|
| `make run`    | Lancer le serveur en dev           |
| `make build`  | Compiler le binaire de production  |
| `make migrate`| Appliquer les migrations SQL       |
| `make sqlc`   | Générer le code depuis les queries |
| `make test`   | Lancer les tests                   |
| `make lint`   | Lancer le linter                   |

## Licence

Propriétaire — Tous droits réservés.
