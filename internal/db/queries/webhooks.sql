-- =============================================================================
-- sqlc queries: webhook_endpoints
-- =============================================================================

-- name: CreateWebhookEndpoint :one
INSERT INTO webhook_endpoints (merchant_id, url, secret)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetWebhookEndpointByID :one
SELECT * FROM webhook_endpoints
WHERE id = $1;

-- name: ListWebhookEndpointsByMerchant :many
SELECT * FROM webhook_endpoints
WHERE merchant_id = $1
ORDER BY created_at DESC;

-- name: GetActiveWebhooksByMerchant :many
SELECT * FROM webhook_endpoints
WHERE merchant_id = $1 AND is_active = true;

-- name: DeleteWebhookEndpoint :exec
DELETE FROM webhook_endpoints
WHERE id = $1 AND merchant_id = $2;

-- name: DeactivateWebhookEndpoint :exec
UPDATE webhook_endpoints
SET is_active = false
WHERE id = $1 AND merchant_id = $2;
