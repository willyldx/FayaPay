cd /opt/kadryza
git restore internal/services/merchant_service.go internal/services/transaction_service.go internal/workers/timeout_worker.go internal/workers/webhook_worker.go
sed -i 's/emit_pointers_for_null_types: false/emit_pointers_for_null_types: true/g' sqlc.yaml
export PATH=$PATH:~/go/bin:/usr/local/go/bin
sqlc generate
go build ./...
