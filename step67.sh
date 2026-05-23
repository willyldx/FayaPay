#!/bin/bash
set -e

echo "=== Etape 6: Docs ==="
cd /opt/kadryza/kadryza-docs
cat > .env.local << 'EOF'
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.spencerai.tech
NEXT_PUBLIC_API_URL=https://api.spencerai.tech
EOF
npm install
npm run build
pm2 start npm --name "kadryza-docs" -- start -- -p 3001
pm2 save
sleep 5
curl -I http://localhost:3001

echo "=== Etape 7: Caddy ==="
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
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
