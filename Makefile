.PHONY: run build migrate sqlc test lint clean

# Run the server in development mode
run:
	go run ./cmd/server

# Build the production binary
build:
	go build -o bin/kadryza-backend ./cmd/server

# Apply all migrations in order
migrate:
	@echo "Applying migrations..."
	psql $(DATABASE_URL) -f internal/db/migrations/001_create_merchants.sql
	psql $(DATABASE_URL) -f internal/db/migrations/002_create_transactions.sql
	psql $(DATABASE_URL) -f internal/db/migrations/003_create_webhook_endpoints.sql
	psql $(DATABASE_URL) -f internal/db/migrations/004_create_audit_logs.sql
	@echo "Migrations applied successfully."

# Generate Go code from SQL queries
sqlc:
	sqlc generate

# Run all tests
test:
	go test ./... -v -race

# Run linter
lint:
	golangci-lint run

# Clean build artifacts
clean:
	rm -rf bin/
