# Kadryza Dashboard

> Interface web pour les marchands Kadryza — gestion des transactions, clés API et webhooks.

## Stack

- **Framework :** Next.js 14 (App Router)
- **UI :** React 18, Tailwind CSS 3, Tremor
- **State :** Zustand + TanStack Query
- **Forms :** React Hook Form + Zod
- **Icons :** Lucide React

## Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.local.example .env.local

# 3. Lancer en développement
npm run dev
```

Le dashboard sera accessible sur `http://localhost:3000`.

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | URL de l'API Kadryza | `https://api.kadryza.app` |
| `NEXT_PUBLIC_APP_NAME` | Nom affiché dans l'interface | `Kadryza` |

## Structure

```
kadryza-dashboard/
├── app/
│   ├── (auth)/         # Pages login/register
│   └── (dashboard)/    # Pages protégées (overview, transactions, webhooks, API keys)
├── components/         # Composants React par domaine
├── lib/
│   ├── api/            # Client HTTP + endpoints
│   ├── auth/           # Logique d'authentification
│   ├── hooks/          # Custom hooks
│   ├── stores/         # Zustand stores
│   ├── types/          # Types TypeScript partagés
│   └── utils/          # Utilitaires
└── middleware.ts       # Protection des routes
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run lint` | Linting ESLint |
