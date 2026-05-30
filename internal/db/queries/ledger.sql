-- =============================================================================
-- sqlc queries: ledger_entries
-- =============================================================================

-- name: CreateLedgerEntry :one
INSERT INTO ledger_entries (
    merchant_id, transaction_id, entry_type, amount, currency, description
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetMerchantLedgerBalance :one
SELECT COALESCE(SUM(amount), 0)::BIGINT AS balance
FROM ledger_entries
WHERE merchant_id = $1;

-- name: GetMerchantLedgerStats :one
SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'PAYMENT'), 0)::BIGINT  AS gross,
    COALESCE(-SUM(amount) FILTER (WHERE entry_type = 'FEE'), 0)::BIGINT     AS fees,
    COALESCE(COUNT(*) FILTER (WHERE entry_type = 'PAYMENT'), 0)::BIGINT     AS payment_count
FROM ledger_entries
WHERE merchant_id = $1;

-- name: LedgerPaymentExists :one
SELECT EXISTS(
    SELECT 1 FROM ledger_entries
    WHERE transaction_id = $1 AND entry_type = 'PAYMENT'
) AS exists;

-- name: ListLedgerEntriesByMerchant :many
SELECT * FROM ledger_entries
WHERE merchant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
