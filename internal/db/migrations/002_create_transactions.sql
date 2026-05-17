-- =============================================================================
-- Migration 002: Create ENUM types + transactions table
-- =============================================================================
-- Depends on: 001_create_merchants (foreign key merchants.id)
-- ENUMs are created here because transactions is the first table to use them.

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

-- Transaction lifecycle states.
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'PENDING',      -- Created, waiting for gateway pickup
        'PROCESSING',   -- Gateway is executing USSD session
        'WAITING_SMS',  -- USSD sent, waiting for operator SMS confirmation
        'SUCCESS',      -- SMS confirmation received and parsed
        'FAILED',       -- USSD failure or negative SMS
        'TIMEOUT',      -- No response within the allowed window
        'REFUNDED'      -- Manually refunded
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supported mobile money operators.
DO $$ BEGIN
    CREATE TYPE operator_type AS ENUM ('AIRTEL', 'MOOV');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supported currencies (XAF only for now — CEMAC zone).
DO $$ BEGIN
    CREATE TYPE currency_type AS ENUM ('XAF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Transactions table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    reference       VARCHAR(100) UNIQUE NOT NULL,   -- Merchant-provided reference (idempotency key)
    internal_ref    VARCHAR(100) UNIQUE NOT NULL,   -- Internal Faya reference (e.g. FAYA-20240115-XXXX)
    amount          BIGINT NOT NULL,                -- Amount in integer centimes XAF — NEVER float
    currency        currency_type DEFAULT 'XAF',
    operator        operator_type NOT NULL,
    phone_number    VARCHAR(20) NOT NULL,            -- Payer's phone number
    description     VARCHAR(255),
    status          transaction_status DEFAULT 'PENDING',
    gateway_id      VARCHAR(100),                   -- ID of the gateway device that processed this
    ussd_session_id VARCHAR(100),                   -- USSD session ID if available
    sms_raw         TEXT,                           -- Raw SMS received (audit trail)
    failure_reason  VARCHAR(255),
    webhook_sent    BOOLEAN DEFAULT false,
    webhook_attempts INT DEFAULT 0,
    initiated_at    TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes (as specified in PRD)
-- ---------------------------------------------------------------------------

-- Fast lookup of transactions by merchant.
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);

-- Fast filtering by status (e.g. dashboard, worker queries).
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Partial index for the timeout worker: only scan PENDING transactions.
CREATE INDEX IF NOT EXISTS idx_transactions_expires ON transactions(expires_at)
    WHERE status = 'PENDING';

COMMIT;
