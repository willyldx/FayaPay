package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/kadryza/kadryza-backend/internal/config"
	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/models"
)

// =============================================================================
// Errors
// =============================================================================

var (
	// ErrKYCInvalidTransition is returned when SubmitKYC is called while the
	// merchant is not in an 'unverified' or 'rejected' state.
	ErrKYCInvalidTransition = errors.New("kyc cannot be submitted from the current status")
	// ErrKYCProfileIncomplete is returned when required business-profile fields
	// are missing at submission time.
	ErrKYCProfileIncomplete = errors.New("kyc business profile is incomplete")
	// ErrKYCNoDocuments is returned when a merchant tries to submit without any
	// uploaded document.
	ErrKYCNoDocuments = errors.New("at least one document is required before submitting")
	// ErrKYCAlreadyVerified is returned when a write is attempted on a merchant
	// whose KYC is already verified.
	ErrKYCAlreadyVerified = errors.New("kyc is already verified")
	// ErrKYCDocumentNotFound is returned when a document does not exist or does
	// not belong to the merchant.
	ErrKYCDocumentNotFound = errors.New("kyc document not found")
	// ErrKYCInvalidDocType is returned for an unsupported document type.
	ErrKYCInvalidDocType = errors.New("unsupported document type")
	// ErrKYCInvalidMimeType is returned for an unsupported file content type.
	ErrKYCInvalidMimeType = errors.New("unsupported file type")
	// ErrKYCFileTooLarge is returned when an upload exceeds the configured limit.
	ErrKYCFileTooLarge = errors.New("file exceeds the maximum allowed size")
)

// allowedKYCMimeTypes is the allowlist of accepted upload content types.
var allowedKYCMimeTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

// =============================================================================
// Service
// =============================================================================

// KYCService handles the merchant KYC flow: business profile, document
// uploads, submission, and back-office review.
type KYCService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	config  *config.Config
	logger  *zap.Logger
}

// NewKYCService creates a new KYCService.
func NewKYCService(pool *pgxpool.Pool, cfg *config.Config, logger *zap.Logger) *KYCService {
	return &KYCService{
		pool:    pool,
		queries: db.New(pool),
		config:  cfg,
		logger:  logger.Named("kyc-svc"),
	}
}

// =============================================================================
// Profile
// =============================================================================

// UpdateProfile applies PATCH-style updates to the merchant business profile.
// nil fields are left untouched (handled by COALESCE in the query).
func (s *KYCService) UpdateProfile(ctx context.Context, merchantID uuid.UUID, req models.UpdateKYCProfileRequest) (*models.MerchantPublic, error) {
	current, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}
	if current.KycStatus == models.KYCStatusVerified {
		return nil, ErrKYCAlreadyVerified
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	merchant, err := qtx.UpdateMerchantKYCProfile(ctx, db.UpdateMerchantKYCProfileParams{
		ID:           merchantID,
		BusinessType: trimPtr(req.BusinessType),
		LegalName:    trimPtr(req.LegalName),
		Rccm:         trimPtr(req.RCCM),
		Nif:          trimPtr(req.NIF),
		ContactPhone: trimPtr(req.ContactPhone),
		Address:      trimPtr(req.Address),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("updating kyc profile: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{"action": "KYC_PROFILE_UPDATED"})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventKYCProfileUpdated,
		Payload:    payload,
	}); err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("kyc profile updated", zap.String("merchant_id", merchantID.String()))
	result := toMerchantPublic(merchant)
	return &result, nil
}

// =============================================================================
// Documents
// =============================================================================

// UploadDocument validates and stores an uploaded KYC document on disk, then
// records it in the database. The file is written before the DB row; on a DB
// failure the orphaned file is removed.
func (s *KYCService) UploadDocument(ctx context.Context, merchantID uuid.UUID, docType, fileName, mimeType string, size int64, src io.Reader) (*models.KYCDocumentPublic, error) {
	docType = strings.ToUpper(strings.TrimSpace(docType))
	if !models.IsValidKYCDocType(docType) {
		return nil, ErrKYCInvalidDocType
	}

	ext, ok := allowedKYCMimeTypes[mimeType]
	if !ok {
		return nil, ErrKYCInvalidMimeType
	}
	if s.config.KYCMaxUploadBytes > 0 && size > s.config.KYCMaxUploadBytes {
		return nil, ErrKYCFileTooLarge
	}

	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}
	if merchant.KycStatus == models.KYCStatusVerified {
		return nil, ErrKYCAlreadyVerified
	}

	// --- Write the file to {uploadDir}/{merchantID}/{uuid}{ext} ---
	dir := filepath.Join(s.config.KYCUploadDir, merchantID.String())
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("creating upload dir: %w", err)
	}
	storedName := uuid.New().String() + ext
	absPath := filepath.Join(dir, storedName)
	// Relative path stored in DB (storage-root-independent).
	relPath := filepath.ToSlash(filepath.Join(merchantID.String(), storedName))

	if err := writeFile(absPath, src); err != nil {
		return nil, fmt.Errorf("saving uploaded file: %w", err)
	}

	cleanFileName := strings.TrimSpace(fileName)
	var fileNamePtr *string
	if cleanFileName != "" {
		fileNamePtr = &cleanFileName
	}
	mimePtr := &mimeType
	sizePtr := &size

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		_ = os.Remove(absPath)
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	doc, err := qtx.CreateKYCDocument(ctx, db.CreateKYCDocumentParams{
		MerchantID: merchantID,
		DocType:    docType,
		FilePath:   relPath,
		FileName:   fileNamePtr,
		MimeType:   mimePtr,
		SizeBytes:  sizePtr,
	})
	if err != nil {
		_ = os.Remove(absPath)
		return nil, fmt.Errorf("recording kyc document: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{"doc_type": docType, "document_id": doc.ID.String()})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventKYCDocumentUploaded,
		Payload:    payload,
	}); err != nil {
		_ = os.Remove(absPath)
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		_ = os.Remove(absPath)
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("kyc document uploaded",
		zap.String("merchant_id", merchantID.String()),
		zap.String("doc_type", docType),
	)
	result := toKYCDocumentPublic(doc)
	return &result, nil
}

// ListDocuments returns all documents uploaded by a merchant.
func (s *KYCService) ListDocuments(ctx context.Context, merchantID uuid.UUID) ([]models.KYCDocumentPublic, error) {
	docs, err := s.queries.ListKYCDocumentsByMerchant(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("listing kyc documents: %w", err)
	}
	out := make([]models.KYCDocumentPublic, 0, len(docs))
	for _, d := range docs {
		out = append(out, toKYCDocumentPublic(d))
	}
	return out, nil
}

// DeleteDocument removes a document (DB row + on-disk file). The file is
// removed only after the DB transaction commits.
func (s *KYCService) DeleteDocument(ctx context.Context, merchantID, documentID uuid.UUID) error {
	doc, err := s.queries.GetKYCDocument(ctx, db.GetKYCDocumentParams{
		ID:         documentID,
		MerchantID: merchantID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrKYCDocumentNotFound
		}
		return fmt.Errorf("querying kyc document: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	if err := qtx.DeleteKYCDocument(ctx, db.DeleteKYCDocumentParams{
		ID:         documentID,
		MerchantID: merchantID,
	}); err != nil {
		return fmt.Errorf("deleting kyc document: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{"document_id": documentID.String()})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventKYCDocumentDeleted,
		Payload:    payload,
	}); err != nil {
		return fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	// Best-effort file removal — a leftover file is harmless, a missing row is not.
	absPath := filepath.Join(s.config.KYCUploadDir, filepath.FromSlash(doc.FilePath))
	if err := os.Remove(absPath); err != nil && !os.IsNotExist(err) {
		s.logger.Warn("failed to remove kyc file from disk",
			zap.String("path", absPath), zap.Error(err))
	}

	s.logger.Info("kyc document deleted",
		zap.String("merchant_id", merchantID.String()),
		zap.String("document_id", documentID.String()),
	)
	return nil
}

// =============================================================================
// Submission & review
// =============================================================================

// Submit moves the merchant into review ('pending'). It requires a complete
// business profile and at least one uploaded document, and is only allowed from
// 'unverified' or 'rejected' (enforced both here and in the SQL guard).
func (s *KYCService) Submit(ctx context.Context, merchantID uuid.UUID) (*models.MerchantPublic, error) {
	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}

	if merchant.KycStatus != models.KYCStatusUnverified && merchant.KycStatus != models.KYCStatusRejected {
		return nil, ErrKYCInvalidTransition
	}
	if emptyPtr(merchant.BusinessType) || emptyPtr(merchant.LegalName) {
		return nil, ErrKYCProfileIncomplete
	}

	count, err := s.queries.CountKYCDocumentsByMerchant(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("counting kyc documents: %w", err)
	}
	if count == 0 {
		return nil, ErrKYCNoDocuments
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	updated, err := qtx.SubmitKYC(ctx, merchantID)
	if err != nil {
		// The SQL WHERE guard yields no rows if the status changed concurrently.
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrKYCInvalidTransition
		}
		return nil, fmt.Errorf("submitting kyc: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{"action": "KYC_SUBMITTED"})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventKYCSubmitted,
		Payload:    payload,
	}); err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("kyc submitted", zap.String("merchant_id", merchantID.String()))
	result := toMerchantPublic(updated)
	return &result, nil
}

// SetStatus records a back-office review outcome. Intended for admin use; the
// caller is responsible for authorizing the operation.
func (s *KYCService) SetStatus(ctx context.Context, merchantID uuid.UUID, status string, rejectionReason *string) (*models.MerchantPublic, error) {
	if !models.IsValidKYCStatus(status) {
		return nil, fmt.Errorf("invalid kyc status %q", status)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	merchant, err := qtx.SetKYCStatus(ctx, db.SetKYCStatusParams{
		ID:                 merchantID,
		KycStatus:          status,
		KycRejectionReason: trimPtr(rejectionReason),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("setting kyc status: %w", err)
	}

	payload, _ := json.Marshal(map[string]string{"status": status})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventKYCStatusChanged,
		Payload:    payload,
	}); err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("kyc status changed",
		zap.String("merchant_id", merchantID.String()),
		zap.String("status", status),
	)
	result := toMerchantPublic(merchant)
	return &result, nil
}

// GetStatus returns the aggregate KYC view (profile + documents) for a merchant.
func (s *KYCService) GetStatus(ctx context.Context, merchantID uuid.UUID) (*models.KYCStatusResponse, error) {
	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}

	docs, err := s.ListDocuments(ctx, merchantID)
	if err != nil {
		return nil, err
	}

	return &models.KYCStatusResponse{
		Status:          merchant.KycStatus,
		BusinessType:    merchant.BusinessType,
		LegalName:       merchant.LegalName,
		RCCM:            merchant.Rccm,
		NIF:             merchant.Nif,
		ContactPhone:    merchant.ContactPhone,
		Address:         merchant.Address,
		SubmittedAt:     merchant.KycSubmittedAt,
		ReviewedAt:      merchant.KycReviewedAt,
		RejectionReason: merchant.KycRejectionReason,
		Documents:       docs,
	}, nil
}

// =============================================================================
// Helpers
// =============================================================================

// toKYCDocumentPublic maps a sqlc-generated row to the safe public model.
func toKYCDocumentPublic(d db.KycDocument) models.KYCDocumentPublic {
	return models.KYCDocumentPublic{
		ID:         d.ID,
		DocType:    d.DocType,
		FileName:   d.FileName,
		MimeType:   d.MimeType,
		SizeBytes:  d.SizeBytes,
		Status:     d.Status,
		UploadedAt: d.UploadedAt,
	}
}

// trimPtr trims surrounding whitespace from a *string and returns nil when the
// input is nil or trims to empty, so blank form fields don't overwrite data.
func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// emptyPtr reports whether a *string is nil or trims to empty.
func emptyPtr(s *string) bool {
	return s == nil || strings.TrimSpace(*s) == ""
}

// writeFile copies src into a newly created file at path.
func writeFile(path string, src io.Reader) error {
	dst, err := os.Create(path)
	if err != nil {
		return err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return err
	}
	return nil
}
