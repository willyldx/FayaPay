-- =============================================================================
-- Migration 004: Create audit_logs table
-- =============================================================================
-- Depends on: 001_create_merchants, 002_create_transactions
--
-- IMMUTABLE by design: this table is INSERT-ONLY.
-- No UPDATE or DELETE should ever be performed on this table.
-- Every transaction status change MUST produce an audit_logs entry.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
    merchant_id    UUID REFERENCES merchants(id) ON DELETE RESTRICT,
    event_type     VARCHAR(100) NOT NULL,  -- e.g. TRANSACTION_INITIATED, SMS_RECEIVED, STATUS_CHANGED
    payload        JSONB,                  -- Raw event data for forensic analysis
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup of audit trail for a specific transaction.
CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction ON audit_logs(transaction_id)
    WHERE transaction_id IS NOT NULL;

-- Fast lookup of all events for a merchant (dashboard, compliance).
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant ON audit_logs(merchant_id)
    WHERE merchant_id IS NOT NULL;

-- Chronological queries (e.g. "last 24h events").
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

COMMIT;
