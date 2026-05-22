-- =============================================================================
-- Migration 003: Create webhook_endpoints table
-- =============================================================================
-- Depends on: 001_create_merchants (foreign key merchants.id)

BEGIN;

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    url         VARCHAR(500) NOT NULL,
    secret      VARCHAR(255) NOT NULL,   -- HMAC-SHA256 signing secret for payloads
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup of active webhooks for a given merchant.
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_merchant ON webhook_endpoints(merchant_id)
    WHERE is_active = true;

COMMIT;
