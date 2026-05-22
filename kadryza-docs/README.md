# Kadryza Documentation

> Documentation publique Kadryza — API de paiement Mobile Money pour le Tchad et la zone CEMAC.

**URL de production :** [docs.kadryza.app](https://docs.kadryza.app)

## Stack

- **Framework :** [Nextra 3](https://nextra.site/) (Next.js)
- **Styling :** Tailwind CSS

## Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.local.example .env.local

# 3. Lancer en développement
npm run dev
```

La documentation sera accessible sur `http://localhost:3000`.

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NEXT_PUBLIC_DASHBOARD_URL` | URL du dashboard Kadryza | `https://dashboard.kadryza.app` |
| `NEXT_PUBLIC_API_URL` | URL de l'API Kadryza | `https://api.kadryza.app` |

## Structure

```
kadryza-docs/
├── pages/
│   ├── index.mdx               # Page d'accueil
│   ├── quickstart.mdx          # Guide de démarrage rapide
│   ├── authentication.mdx      # Authentification API
│   ├── errors.mdx              # Codes d'erreur
│   ├── api-reference/          # Référence API complète
│   │   ├── transactions.mdx
│   │   └── webhooks.mdx
│   ├── guides/                 # Guides d'intégration
│   │   ├── nextjs.mdx
│   │   ├── expressjs.mdx
│   │   └── webhook-verification.mdx
│   └── sdk/                    # Documentation SDK
│       ├── index.mdx
│       └── reference.mdx
├── components/                 # Composants React pour la doc
└── styles/
    └── globals.css
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
