package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/models"
)

// =============================================================================
// Errors
// =============================================================================

var (
	ErrInsufficientBalance      = errors.New("insufficient available balance")
	ErrSettlementNotFound       = errors.New("settlement not found")
	ErrSettlementNotCancellable = errors.New("settlement cannot be cancelled")
)

var validSettlementMethods = map[string]bool{"AIRTEL": true, "MOOV": true, "BANK": true}

// =============================================================================
// Service
// =============================================================================

// BillingService exposes the merchant balance (ledger) and settlements (payouts).
type BillingService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	logger  *zap.Logger
}

// NewBillingService creates a new BillingService.
func NewBillingService(pool *pgxpool.Pool, logger *zap.Logger) *BillingService {
	return &BillingService{
		pool:    pool,
		queries: db.New(pool),
		logger:  logger.Named("billing-svc"),
	}
}

// =============================================================================
// Balance
// =============================================================================

// GetBalance computes the merchant's balance overview.
func (s *BillingService) GetBalance(ctx context.Context, merchantID uuid.UUID) (*models.Balance, error) {
	balance, err := s.queries.GetMerchantLedgerBalance(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("ledger balance: %w", err)
	}
	reserved, err := s.queries.GetReservedSettlementTotal(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("reserved total: %w", err)
	}
	stats, err := s.queries.GetMerchantLedgerStats(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("ledger stats: %w", err)
	}
	settled, err := s.queries.GetSettlementTotalByStatus(ctx, db.GetSettlementTotalByStatusParams{
		MerchantID: merchantID,
		Status:     "COMPLETED",
	})
	if err != nil {
		return nil, fmt.Errorf("settled total: %w", err)
	}
	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("merchant: %w", err)
	}

	return &models.Balance{
		Available:    balance - reserved,
		Reserved:     reserved,
		TotalVolume:  stats.Gross,
		TotalFees:    stats.Fees,
		TotalSettled: settled,
		PaymentCount: stats.PaymentCount,
		Currency:     "XAF",
		FeeBps:       merchant.FeeBps,
	}, nil
}

// availableBalance returns the currently withdrawable amount.
func (s *BillingService) availableBalance(ctx context.Context, merchantID uuid.UUID) (int64, error) {
	balance, err := s.queries.GetMerchantLedgerBalance(ctx, merchantID)
	if err != nil {
		return 0, err
	}
	reserved, err := s.queries.GetReservedSettlementTotal(ctx, merchantID)
	if err != nil {
		return 0, err
	}
	return balance - reserved, nil
}

// =============================================================================
// Settlements
// =============================================================================

// CreateSettlement requests a payout of `amount` to the given destination.
func (s *BillingService) CreateSettlement(ctx context.Context, merchantID uuid.UUID, req models.CreateSettlementRequest) (*models.SettlementPublic, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("validation: amount must be a positive integer")
	}
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if !validSettlementMethods[method] {
		return nil, fmt.Errorf("validation: method must be AIRTEL, MOOV or BANK")
	}
	dest := strings.TrimSpace(req.Destination)
	if dest == "" {
		return nil, fmt.Errorf("validation: destination is required")
	}

	available, err := s.availableBalance(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("computing available balance: %w", err)
	}
	if req.Amount > available {
		return nil, ErrInsufficientBalance
	}

	settlement, err := s.queries.CreateSettlement(ctx, db.CreateSettlementParams{
		MerchantID:  merchantID,
		Amount:      req.Amount,
		Currency:    "XAF",
		Method:      method,
		Destination: dest,
	})
	if err != nil {
		return nil, fmt.Errorf("creating settlement: %w", err)
	}

	s.logger.Info("settlement requested",
		zap.String("merchant_id", merchantID.String()),
		zap.String("settlement_id", settlement.ID.String()),
		zap.Int64("amount", req.Amount),
	)
	result := toSettlementPublic(settlement)
	return &result, nil
}

// ListSettlements returns the merchant's payout history.
func (s *BillingService) ListSettlements(ctx context.Context, merchantID uuid.UUID, limit, offset int32) (*models.SettlementListResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.queries.ListSettlementsByMerchant(ctx, db.ListSettlementsByMerchantParams{
		MerchantID: merchantID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, fmt.Errorf("listing settlements: %w", err)
	}
	total, err := s.queries.CountSettlementsByMerchant(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("counting settlements: %w", err)
	}
	result := make([]models.SettlementPublic, len(rows))
	for i, st := range rows {
		result[i] = toSettlementPublic(st)
	}
	return &models.SettlementListResponse{
		Settlements: result,
		Total:       total,
		Limit:       limit,
		Offset:      offset,
	}, nil
}

// GetSettlement retrieves one settlement, verifying ownership.
func (s *BillingService) GetSettlement(ctx context.Context, merchantID, id uuid.UUID) (*models.SettlementPublic, error) {
	st, err := s.queries.GetSettlementByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSettlementNotFound
		}
		return nil, fmt.Errorf("querying settlement: %w", err)
	}
	if st.MerchantID != merchantID {
		return nil, ErrSettlementNotFound
	}
	result := toSettlementPublic(st)
	return &result, nil
}

// CancelSettlement cancels a PENDING settlement (releasing the reserved amount).
func (s *BillingService) CancelSettlement(ctx context.Context, merchantID, id uuid.UUID) (*models.SettlementPublic, error) {
	st, err := s.queries.CancelSettlement(ctx, db.CancelSettlementParams{ID: id, MerchantID: merchantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Not found, not owned, or not in PENDING state.
			return nil, ErrSettlementNotCancellable
		}
		return nil, fmt.Errorf("cancelling settlement: %w", err)
	}
	result := toSettlementPublic(st)
	return &result, nil
}

// =============================================================================
// Helpers
// =============================================================================

func toSettlementPublic(st db.Settlement) models.SettlementPublic {
	return models.SettlementPublic{
		ID:            st.ID,
		Amount:        st.Amount,
		Currency:      fmt.Sprint(st.Currency),
		Status:        fmt.Sprint(st.Status),
		Method:        st.Method,
		Destination:   st.Destination,
		FailureReason: st.FailureReason,
		RequestedAt:   st.RequestedAt,
		CompletedAt:   st.CompletedAt,
		CreatedAt:     st.CreatedAt,
	}
}
