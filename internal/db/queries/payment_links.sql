-- =============================================================================
-- sqlc queries: payment_links
-- =============================================================================

-- name: CreatePaymentLink :one
INSERT INTO payment_links (
    merchant_id, slug, amount, currency, description, is_reusable, success_url, expires_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetPaymentLinkByID :one
SELECT * FROM payment_links
WHERE id = $1;

-- name: GetPaymentLinkBySlug :one
SELECT * FROM payment_links
WHERE slug = $1;

-- name: ListPaymentLinksByMerchant :many
SELECT * FROM payment_links
WHERE merchant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPaymentLinksByMerchant :one
SELECT COUNT(*) FROM payment_links
WHERE merchant_id = $1;

-- name: SetPaymentLinkActive :one
UPDATE payment_links
SET is_active  = $2,
    updated_at = NOW()
WHERE id = $1 AND merchant_id = $3
RETURNING *;

-- name: IncrementPaymentLinkPaidCount :exec
UPDATE payment_links
SET paid_count = paid_count + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DeletePaymentLink :exec
DELETE FROM payment_links
WHERE id = $1 AND merchant_id = $2;
