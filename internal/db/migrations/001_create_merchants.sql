-- =============================================================================
-- Migration 001: Create merchants table
-- =============================================================================
-- This must run FIRST — transactions and webhook_endpoints depend on it.

BEGIN;

CREATE TABLE IF NOT EXISTS merchants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key_hash  VARCHAR(255) UNIQUE,          -- SHA-256 hash of the API key
    api_key_prefix VARCHAR(10),                  -- e.g. "kadryza_live_" for display
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index on email for fast login lookups.
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);

-- Index on api_key_hash for fast API key authentication.
CREATE INDEX IF NOT EXISTS idx_merchants_api_key_hash ON merchants(api_key_hash) WHERE api_key_hash IS NOT NULL;

COMMIT;
