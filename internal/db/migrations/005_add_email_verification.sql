-- =============================================================================
-- Migration 005: Add email verification & password reset columns to merchants
-- =============================================================================
-- Depends on: 001_create_merchants

BEGIN;

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS email_verified             BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_token         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reset_password_token       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_password_expires_at  TIMESTAMPTZ;

-- Partial index for fast token lookup during email verification.
CREATE INDEX IF NOT EXISTS idx_merchants_verification_token
    ON merchants(verification_token)
    WHERE verification_token IS NOT NULL;

-- Partial index for fast token lookup during password reset.
CREATE INDEX IF NOT EXISTS idx_merchants_reset_password_token
    ON merchants(reset_password_token)
    WHERE reset_password_token IS NOT NULL;

COMMIT;
