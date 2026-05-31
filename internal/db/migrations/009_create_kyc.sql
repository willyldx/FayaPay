-- =============================================================================
-- Migration 009: KYC (in-house manual verification)
-- =============================================================================
-- Depends on: 001_create_merchants.
-- Statuses use VARCHAR + CHECK (not Postgres enums) to keep sqlc scanning simple
-- and to make adding a value a one-line change. A provider abstraction lives in
-- the service layer so an automated provider (e.g. Smile ID) can be plugged in
-- later without schema changes.

BEGIN;

-- --- Merchant KYC + business profile ---------------------------------------
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
        CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
    ADD COLUMN IF NOT EXISTS business_type VARCHAR(20)
        CHECK (business_type IS NULL OR business_type IN ('individual', 'company')),
    ADD COLUMN IF NOT EXISTS legal_name           VARCHAR(255),  -- raison sociale / nom légal
    ADD COLUMN IF NOT EXISTS rccm                 VARCHAR(100),  -- Registre du Commerce (CEMAC)
    ADD COLUMN IF NOT EXISTS nif                  VARCHAR(100),  -- Numéro d'Identification Fiscale
    ADD COLUMN IF NOT EXISTS contact_phone        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address              VARCHAR(500),
    ADD COLUMN IF NOT EXISTS kyc_submitted_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS kyc_reviewed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS kyc_rejection_reason VARCHAR(500);

-- --- Uploaded KYC documents -------------------------------------------------
CREATE TABLE IF NOT EXISTS kyc_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    -- ID_CARD | PASSPORT | RCCM | NIF | PROOF_OF_ADDRESS | SELFIE | OTHER
    doc_type    VARCHAR(40) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,   -- storage path relative to the uploads root
    file_name   VARCHAR(255),            -- original client filename
    mime_type   VARCHAR(100),
    size_bytes  BIGINT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_merchant ON kyc_documents(merchant_id);

COMMIT;
