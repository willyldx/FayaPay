-- =============================================================================
-- Migration 008: Sandbox / test mode (test API keys + is_test transactions)
-- =============================================================================
-- Depends on: 001_create_merchants, 002_create_transactions.

BEGIN;

-- FIX: "kadryza_live_" / "kadryza_test_" are 13 chars; widen the prefix column.
ALTER TABLE merchants
    ALTER COLUMN api_key_prefix TYPE VARCHAR(20);

-- Separate test API key (kadryza_test_...) per merchant.
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS test_api_key_hash   VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS test_api_key_prefix VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_merchants_test_api_key_hash
    ON merchants(test_api_key_hash)
    WHERE test_api_key_hash IS NOT NULL;

-- Transactions created with a test key never touch the real gateway or balance.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

COMMIT;
