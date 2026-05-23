#!/bin/bash

set -e

echo "🚀 Déploiement Kadryza..."

cd /opt/kadryza

# Pull dernières modifications
# git pull origin main

# Backend
echo "📦 Build backend..."
cd kadryza-backend
go mod tidy
sqlc generate
go build -o ../kadryza-server ./cmd/server
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

# Nginx
echo "🔄 Reload Nginx..."
sudo systemctl reload nginx
echo "✅ Nginx rechargé"

echo "🎉 Déploiement terminé !"

# Smoke tests rapides
sleep 3
curl -s -f https://api-kadryza.spencerai.tech/health >/dev/null && echo "✅ API OK" || echo "❌ Erreur API"
curl -s -I https://dashboard.kadryza.spencerai.tech | grep -q "307\|200" && echo "✅ Dashboard OK" || echo "❌ Erreur Dashboard"
curl -s -I https://docs.kadryza.spencerai.tech | grep -q "200" && echo "✅ Docs OK" || echo "❌ Erreur Docs"
