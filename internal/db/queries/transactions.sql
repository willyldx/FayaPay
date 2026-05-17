-- =============================================================================
-- sqlc queries: transactions
-- =============================================================================

-- name: CreateTransaction :one
INSERT INTO transactions (
    merchant_id, reference, internal_ref, amount, currency,
    operator, phone_number, description
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetTransactionByID :one
SELECT * FROM transactions
WHERE id = $1;

-- name: GetTransactionByReference :one
SELECT * FROM transactions
WHERE reference = $1 AND merchant_id = $2;

-- name: UpdateTransactionStatus :one
UPDATE transactions
SET status         = $2,
    failure_reason = $3,
    updated_at     = NOW()
WHERE id = $1
RETURNING *;

-- name: ConfirmTransaction :one
UPDATE transactions
SET status       = 'SUCCESS',
    confirmed_at = NOW(),
    sms_raw      = $2,
    updated_at   = NOW()
WHERE id = $1
RETURNING *;

-- name: AssignGateway :exec
UPDATE transactions
SET gateway_id      = $2,
    ussd_session_id = $3,
    status          = 'PROCESSING',
    updated_at      = NOW()
WHERE id = $1;

-- name: MarkWebhookSent :exec
UPDATE transactions
SET webhook_sent     = true,
    webhook_attempts = webhook_attempts + 1,
    updated_at       = NOW()
WHERE id = $1;

-- name: IncrementWebhookAttempts :exec
UPDATE transactions
SET webhook_attempts = webhook_attempts + 1,
    updated_at       = NOW()
WHERE id = $1;

-- name: ListTransactionsByMerchant :many
SELECT * FROM transactions
WHERE merchant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountTransactionsByMerchant :one
SELECT COUNT(*) FROM transactions
WHERE merchant_id = $1;

-- name: ListExpiredTransactions :many
SELECT * FROM transactions
WHERE (status = 'PENDING' OR status = 'PROCESSING')
  AND expires_at < NOW();

-- name: FailGatewayTransactions :exec
UPDATE transactions
SET status         = 'FAILED',
    failure_reason = 'GATEWAY_DISCONNECTED',
    updated_at     = NOW()
WHERE gateway_id = $1
  AND (status = 'PROCESSING' OR status = 'WAITING_SMS');
