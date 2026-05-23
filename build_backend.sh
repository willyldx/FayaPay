cd /opt/kadryza
export PATH=$PATH:~/go/bin:/usr/local/go/bin

go mod tidy
sqlc generate

for f in internal/db/migrations/*.sql; do
  sudo docker exec -i kadryza-postgres psql -U kadryza -d kadryza < "$f"
done

sudo docker exec -i kadryza-postgres psql -U kadryza -d kadryza -c "\dt"

go build -o bin/kadryza-backend ./cmd/server
ls -la bin/
