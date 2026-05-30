-- =============================================================================
-- Migration 006: Payment links (hosted checkout)
-- =============================================================================
-- Depends on: 001_create_merchants, 002_create_transactions (currency_type,
--             update_updated_at()).

BEGIN;

CREATE TABLE IF NOT EXISTS payment_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    slug         VARCHAR(32) UNIQUE NOT NULL,          -- public checkout token
    amount       BIGINT NOT NULL CHECK (amount > 0),   -- integer XAF, always positive
    currency     currency_type DEFAULT 'XAF',
    description  VARCHAR(255),
    is_active    BOOLEAN DEFAULT true,
    is_reusable  BOOLEAN DEFAULT true,                 -- false = single successful payment
    success_url  VARCHAR(500),                         -- optional redirect after payment
    paid_count   INTEGER DEFAULT 0,                    -- number of successful payments
    expires_at   TIMESTAMPTZ,                          -- optional expiry (NULL = never)
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON payment_links(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_slug ON payment_links(slug);

-- Tie transactions back to the payment link that created them (nullable).
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES payment_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_link ON transactions(payment_link_id)
    WHERE payment_link_id IS NOT NULL;

-- Auto-update updated_at (function defined in 002). Idempotent for re-runs.
CREATE OR REPLACE TRIGGER payment_links_updated_at
    BEFORE UPDATE ON payment_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
