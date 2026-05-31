-- =============================================================================
-- sqlc queries: kyc_documents
-- =============================================================================

-- name: CreateKYCDocument :one
INSERT INTO kyc_documents (merchant_id, doc_type, file_path, file_name, mime_type, size_bytes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListKYCDocumentsByMerchant :many
SELECT * FROM kyc_documents
WHERE merchant_id = $1
ORDER BY uploaded_at DESC;

-- name: GetKYCDocument :one
SELECT * FROM kyc_documents
WHERE id = $1 AND merchant_id = $2;

-- name: DeleteKYCDocument :exec
DELETE FROM kyc_documents
WHERE id = $1 AND merchant_id = $2;

-- name: CountKYCDocumentsByMerchant :one
SELECT COUNT(*) FROM kyc_documents
WHERE merchant_id = $1;
