-- =============================================================================
-- sqlc queries: merchants
-- =============================================================================

-- name: CreateMerchant :one
INSERT INTO merchants (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetMerchantByID :one
SELECT * FROM merchants
WHERE id = $1;

-- name: GetMerchantByEmail :one
SELECT * FROM merchants
WHERE email = $1;

-- name: GetMerchantByAPIKeyHash :one
SELECT * FROM merchants
WHERE api_key_hash = $1 AND is_active = true;

-- name: GetMerchantByAPIKeyPrefix :one
SELECT * FROM merchants
WHERE api_key_prefix = $1 AND is_active = true;

-- name: UpdateMerchantAPIKey :one
UPDATE merchants
SET api_key_hash  = $2,
    api_key_prefix = $3,
    updated_at     = NOW()
WHERE id = $1
RETURNING *;

-- name: RevokeAPIKey :exec
UPDATE merchants
SET api_key_hash  = NULL,
    api_key_prefix = NULL,
    updated_at     = NOW()
WHERE id = $1;

-- name: UpdateMerchant :one
UPDATE merchants
SET name       = COALESCE(sqlc.narg('name'), name),
    email      = COALESCE(sqlc.narg('email'), email),
    is_active  = COALESCE(sqlc.narg('is_active'), is_active),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;
