package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

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
	ErrPaymentLinkNotFound = errors.New("payment link not found")
	ErrPaymentLinkInactive = errors.New("payment link is inactive")
	ErrPaymentLinkExpired  = errors.New("payment link has expired")
)

// =============================================================================
// Service
// =============================================================================

// PaymentLinkService manages payment links and the public hosted checkout.
type PaymentLinkService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	config  *config.Config
	logger  *zap.Logger
}

// NewPaymentLinkService creates a new PaymentLinkService.
func NewPaymentLinkService(pool *pgxpool.Pool, cfg *config.Config, logger *zap.Logger) *PaymentLinkService {
	return &PaymentLinkService{
		pool:    pool,
		queries: db.New(pool),
		config:  cfg,
		logger:  logger.Named("payment-link-svc"),
	}
}

// =============================================================================
// Dashboard (JWT) operations
// =============================================================================

// Create creates a new payment link for the merchant.
func (s *PaymentLinkService) Create(ctx context.Context, merchantID uuid.UUID, req models.CreatePaymentLinkRequest) (*models.PaymentLinkPublic, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("validation: amount must be a positive integer")
	}
	if len(req.Description) > 255 {
		return nil, fmt.Errorf("validation: description must not exceed 255 characters")
	}

	isReusable := true
	if req.IsReusable != nil {
		isReusable = *req.IsReusable
	}

	var description *string
	if d := strings.TrimSpace(req.Description); d != "" {
		description = &d
	}
	var successURL *string
	if u := strings.TrimSpace(req.SuccessURL); u != "" {
		successURL = &u
	}

	// Generate a unique slug, retrying on the (rare) unique-constraint collision.
	var link db.PaymentLink
	var err error
	for attempt := 0; attempt < 5; attempt++ {
		var slug string
		slug, err = generateSlug(12)
		if err != nil {
			return nil, fmt.Errorf("generating slug: %w", err)
		}
		link, err = s.queries.CreatePaymentLink(ctx, db.CreatePaymentLinkParams{
			MerchantID:  merchantID,
			Slug:        slug,
			Amount:      req.Amount,
			Currency:    "XAF",
			Description: description,
			IsReusable:  &isReusable,
			SuccessUrl:  successURL,
			ExpiresAt:   req.ExpiresAt,
		})
		if err == nil {
			break
		}
		if !isUniqueViolation(err) {
			return nil, fmt.Errorf("creating payment link: %w", err)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("creating payment link after retries: %w", err)
	}

	s.logger.Info("payment link created",
		zap.String("merchant_id", merchantID.String()),
		zap.String("slug", link.Slug),
	)
	result := s.toPublic(link)
	return &result, nil
}

// List returns a paginated list of payment links for a merchant.
func (s *PaymentLinkService) List(ctx context.Context, merchantID uuid.UUID, limit, offset int32) (*models.PaymentLinkListResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	links, err := s.queries.ListPaymentLinksByMerchant(ctx, db.ListPaymentLinksByMerchantParams{
		MerchantID: merchantID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, fmt.Errorf("listing payment links: %w", err)
	}
	total, err := s.queries.CountPaymentLinksByMerchant(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("counting payment links: %w", err)
	}

	result := make([]models.PaymentLinkPublic, len(links))
	for i, l := range links {
		result[i] = s.toPublic(l)
	}

	return &models.PaymentLinkListResponse{
		PaymentLinks: result,
		Total:        total,
		Limit:        limit,
		Offset:       offset,
	}, nil
}

// GetByID retrieves a single payment link, verifying merchant ownership.
func (s *PaymentLinkService) GetByID(ctx context.Context, merchantID, id uuid.UUID) (*models.PaymentLinkPublic, error) {
	link, err := s.queries.GetPaymentLinkByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPaymentLinkNotFound
		}
		return nil, fmt.Errorf("querying payment link: %w", err)
	}
	if link.MerchantID != merchantID {
		return nil, ErrPaymentLinkNotFound
	}
	result := s.toPublic(link)
	return &result, nil
}

// SetActive activates or deactivates a payment link.
func (s *PaymentLinkService) SetActive(ctx context.Context, merchantID, id uuid.UUID, active bool) (*models.PaymentLinkPublic, error) {
	link, err := s.queries.SetPaymentLinkActive(ctx, db.SetPaymentLinkActiveParams{
		ID:         id,
		IsActive:   &active,
		MerchantID: merchantID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPaymentLinkNotFound
		}
		return nil, fmt.Errorf("updating payment link: %w", err)
	}
	result := s.toPublic(link)
	return &result, nil
}

// Delete removes a payment link (transactions keep a NULL payment_link_id).
func (s *PaymentLinkService) Delete(ctx context.Context, merchantID, id uuid.UUID) error {
	link, err := s.queries.GetPaymentLinkByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrPaymentLinkNotFound
		}
		return fmt.Errorf("querying payment link: %w", err)
	}
	if link.MerchantID != merchantID {
		return ErrPaymentLinkNotFound
	}
	if err := s.queries.DeletePaymentLink(ctx, db.DeletePaymentLinkParams{ID: id, MerchantID: merchantID}); err != nil {
		return fmt.Errorf("deleting payment link: %w", err)
	}
	return nil
}

// =============================================================================
// Public (no-auth) checkout operations
// =============================================================================

// GetCheckoutView returns the payer-facing view of a payment link by slug.
func (s *PaymentLinkService) GetCheckoutView(ctx context.Context, slug string) (*models.CheckoutView, error) {
	link, err := s.queries.GetPaymentLinkBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPaymentLinkNotFound
		}
		return nil, fmt.Errorf("querying payment link: %w", err)
	}
	merchant, err := s.queries.GetMerchantByID(ctx, link.MerchantID)
	if err != nil {
		return nil, fmt.Errorf("querying merchant: %w", err)
	}
	return &models.CheckoutView{
		Slug:         link.Slug,
		Amount:       link.Amount,
		Currency:     fmt.Sprint(link.Currency),
		Description:  link.Description,
		MerchantName: merchant.Name,
		IsPayable:    s.isPayable(link),
	}, nil
}

// GetPayableLink returns the raw link for a slug if it can currently be paid.
func (s *PaymentLinkService) GetPayableLink(ctx context.Context, slug string) (db.PaymentLink, error) {
	link, err := s.queries.GetPaymentLinkBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.PaymentLink{}, ErrPaymentLinkNotFound
		}
		return db.PaymentLink{}, fmt.Errorf("querying payment link: %w", err)
	}
	if link.IsActive == nil || !*link.IsActive {
		return db.PaymentLink{}, ErrPaymentLinkInactive
	}
	if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
		return db.PaymentLink{}, ErrPaymentLinkExpired
	}
	return link, nil
}

// RecordPayment increments the link's payment counter.
func (s *PaymentLinkService) RecordPayment(ctx context.Context, linkID uuid.UUID) error {
	return s.queries.IncrementPaymentLinkPaidCount(ctx, linkID)
}

// GetTransactionStatus returns the minimal public status of a checkout payment.
// Only transactions that originated from a payment link are exposed.
func (s *PaymentLinkService) GetTransactionStatus(ctx context.Context, txID uuid.UUID) (*models.CheckoutTransactionStatus, error) {
	txn, err := s.queries.GetTransactionByID(ctx, txID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPaymentLinkNotFound
		}
		return nil, fmt.Errorf("querying transaction: %w", err)
	}
	if txn.PaymentLinkID == nil {
		// Not a checkout-originated transaction — don't expose it publicly.
		return nil, ErrPaymentLinkNotFound
	}
	return &models.CheckoutTransactionStatus{
		ID:            txn.ID,
		Status:        fmt.Sprint(txn.Status),
		Amount:        txn.Amount,
		FailureReason: txn.FailureReason,
	}, nil
}

// =============================================================================
// Helpers
// =============================================================================

func (s *PaymentLinkService) isPayable(link db.PaymentLink) bool {
	if link.IsActive == nil || !*link.IsActive {
		return false
	}
	if link.ExpiresAt != nil && link.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

func (s *PaymentLinkService) checkoutURL(slug string) string {
	base := strings.TrimRight(s.config.AppURL, "/")
	return base + "/pay/" + slug
}

func (s *PaymentLinkService) toPublic(l db.PaymentLink) models.PaymentLinkPublic {
	var paidCount int32
	if l.PaidCount != nil {
		paidCount = *l.PaidCount
	}
	return models.PaymentLinkPublic{
		ID:          l.ID,
		Slug:        l.Slug,
		Amount:      l.Amount,
		Currency:    fmt.Sprint(l.Currency),
		Description: l.Description,
		IsActive:    l.IsActive != nil && *l.IsActive,
		IsReusable:  l.IsReusable != nil && *l.IsReusable,
		SuccessURL:  l.SuccessUrl,
		PaidCount:   paidCount,
		ExpiresAt:   l.ExpiresAt,
		URL:         s.checkoutURL(l.Slug),
		CreatedAt:   l.CreatedAt,
	}
}

// generateSlug returns a URL-safe random slug of n characters.
func generateSlug(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	s := base64.RawURLEncoding.EncodeToString(b)
	if len(s) > n {
		s = s[:n]
	}
	return s, nil
}
