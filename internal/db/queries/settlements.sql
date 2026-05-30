-- =============================================================================
-- sqlc queries: settlements
-- =============================================================================

-- name: CreateSettlement :one
INSERT INTO settlements (merchant_id, amount, currency, method, destination)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetSettlementByID :one
SELECT * FROM settlements
WHERE id = $1;

-- name: ListSettlementsByMerchant :many
SELECT * FROM settlements
WHERE merchant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSettlementsByMerchant :one
SELECT COUNT(*) FROM settlements
WHERE merchant_id = $1;

-- name: GetReservedSettlementTotal :one
-- Money in transit: requested or being processed, not yet paid out.
SELECT COALESCE(SUM(amount), 0)::BIGINT AS total
FROM settlements
WHERE merchant_id = $1
  AND status IN ('PENDING', 'PROCESSING');

-- name: GetSettlementTotalByStatus :one
SELECT COALESCE(SUM(amount), 0)::BIGINT AS total
FROM settlements
WHERE merchant_id = $1 AND status = $2;

-- name: CancelSettlement :one
UPDATE settlements
SET status     = 'CANCELLED',
    updated_at = NOW()
WHERE id = $1 AND merchant_id = $2 AND status = 'PENDING'
RETURNING *;

-- name: MarkSettlementProcessing :one
UPDATE settlements
SET status     = 'PROCESSING',
    updated_at = NOW()
WHERE id = $1 AND status = 'PENDING'
RETURNING *;

-- name: CompleteSettlement :one
UPDATE settlements
SET status       = 'COMPLETED',
    completed_at = NOW(),
    updated_at   = NOW()
WHERE id = $1 AND status IN ('PENDING', 'PROCESSING')
RETURNING *;

-- name: FailSettlement :one
UPDATE settlements
SET status         = 'FAILED',
    failure_reason = $2,
    completed_at   = NOW(),
    updated_at     = NOW()
WHERE id = $1 AND status IN ('PENDING', 'PROCESSING')
RETURNING *;
