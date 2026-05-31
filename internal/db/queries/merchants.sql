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

-- name: GetMerchantByTestAPIKeyHash :one
SELECT * FROM merchants
WHERE test_api_key_hash = $1 AND is_active = true;

-- name: UpdateMerchantTestAPIKey :one
UPDATE merchants
SET test_api_key_hash   = $2,
    test_api_key_prefix = $3,
    updated_at          = NOW()
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

-- =============================================================================
-- Email verification queries
-- =============================================================================

-- name: SetVerificationToken :exec
UPDATE merchants
SET verification_token            = $2,
    verification_token_expires_at = $3,
    updated_at                    = NOW()
WHERE id = $1;

-- name: GetMerchantByVerificationToken :one
SELECT * FROM merchants
WHERE verification_token = $1
  AND verification_token_expires_at > NOW();

-- name: VerifyEmail :exec
UPDATE merchants
SET email_verified                = true,
    verification_token            = NULL,
    verification_token_expires_at = NULL,
    updated_at                    = NOW()
WHERE id = $1;

-- name: IsEmailVerified :one
SELECT email_verified FROM merchants WHERE id = $1;

-- =============================================================================
-- Password reset queries
-- =============================================================================

-- name: SetResetPasswordToken :exec
UPDATE merchants
SET reset_password_token      = $2,
    reset_password_expires_at = $3,
    updated_at                = NOW()
WHERE id = $1;

-- name: GetMerchantByResetToken :one
SELECT * FROM merchants
WHERE reset_password_token = $1
  AND reset_password_expires_at > NOW();

-- name: UpdatePassword :exec
UPDATE merchants
SET password_hash             = $2,
    reset_password_token      = NULL,
    reset_password_expires_at = NULL,
    updated_at                = NOW()
WHERE id = $1;

-- name: UpdateMerchantName :one
UPDATE merchants
SET name       = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- =============================================================================
-- KYC queries
-- =============================================================================

-- name: UpdateMerchantKYCProfile :one
UPDATE merchants
SET business_type = COALESCE(sqlc.narg('business_type'), business_type),
    legal_name    = COALESCE(sqlc.narg('legal_name'), legal_name),
    rccm          = COALESCE(sqlc.narg('rccm'), rccm),
    nif           = COALESCE(sqlc.narg('nif'), nif),
    contact_phone = COALESCE(sqlc.narg('contact_phone'), contact_phone),
    address       = COALESCE(sqlc.narg('address'), address),
    updated_at    = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: SubmitKYC :one
-- Moves the merchant into review. Allowed only from 'unverified' or 'rejected'.
UPDATE merchants
SET kyc_status           = 'pending',
    kyc_submitted_at     = NOW(),
    kyc_rejection_reason = NULL,
    updated_at           = NOW()
WHERE id = $1
  AND kyc_status IN ('unverified', 'rejected')
RETURNING *;

-- name: SetKYCStatus :one
-- Admin/back-office review outcome (verified | rejected | pending | unverified).
UPDATE merchants
SET kyc_status           = sqlc.arg('kyc_status'),
    kyc_rejection_reason = sqlc.narg('kyc_rejection_reason'),
    kyc_reviewed_at      = NOW(),
    updated_at           = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;
