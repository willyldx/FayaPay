-- =============================================================================
-- sqlc queries: audit_logs
-- =============================================================================
-- IMMUTABLE table — INSERT only, no UPDATE or DELETE queries.

-- name: CreateAuditLog :one
INSERT INTO audit_logs (transaction_id, merchant_id, event_type, payload)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListAuditLogsByTransaction :many
SELECT * FROM audit_logs
WHERE transaction_id = $1
ORDER BY created_at ASC;

-- name: ListAuditLogsByMerchant :many
SELECT * FROM audit_logs
WHERE merchant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
