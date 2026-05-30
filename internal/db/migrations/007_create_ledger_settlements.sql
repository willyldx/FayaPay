-- =============================================================================
-- Migration 007: Balance ledger, fees, and settlements
-- =============================================================================
-- Depends on: 001_create_merchants, 002_create_transactions (currency_type,
--             update_updated_at()).

BEGIN;

-- Per-merchant fee rate, in basis points (250 = 2.5%). Charged on each
-- successful payment: net = gross - (gross * fee_bps / 10000).
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS fee_bps INTEGER NOT NULL DEFAULT 250;

-- ---------------------------------------------------------------------------
-- Ledger: append-only record of every balance movement (auditable).
--   amount is SIGNED: positive = credit, negative = debit.
--   PAYMENT (+gross), FEE (-fee), REFUND (-amount), ADJUSTMENT (±).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    entry_type     VARCHAR(20) NOT NULL,            -- PAYMENT | FEE | REFUND | ADJUSTMENT
    amount         BIGINT NOT NULL,                 -- signed XAF
    currency       currency_type DEFAULT 'XAF',
    description    VARCHAR(255),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_merchant ON ledger_entries(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);

-- One PAYMENT entry per transaction max — prevents double-crediting on retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_payment_per_txn
    ON ledger_entries(transaction_id, entry_type)
    WHERE transaction_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Settlements (payouts requested by the merchant).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS settlements (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount         BIGINT NOT NULL CHECK (amount > 0),
    currency       currency_type DEFAULT 'XAF',
    status         settlement_status DEFAULT 'PENDING',
    method         VARCHAR(30) NOT NULL,            -- AIRTEL | MOOV | BANK
    destination    VARCHAR(120) NOT NULL,           -- phone number or account
    failure_reason VARCHAR(255),
    requested_at   TIMESTAMPTZ DEFAULT NOW(),
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

CREATE OR REPLACE TRIGGER settlements_updated_at
    BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
