package models

import (
	"time"

	"github.com/google/uuid"
)

// Balance is the merchant's balance overview (all amounts in integer XAF).
type Balance struct {
	Available    int64  `json:"available"`     // retirable (ledger - settlements réservés)
	Reserved     int64  `json:"reserved"`      // en cours de reversement
	TotalVolume  int64  `json:"total_volume"`  // brut encaissé
	TotalFees    int64  `json:"total_fees"`    // frais payés
	TotalSettled int64  `json:"total_settled"` // total reversé (COMPLETED)
	PaymentCount int64  `json:"payment_count"`
	Currency     string `json:"currency"`
	FeeBps       int32  `json:"fee_bps"` // taux de frais en points de base
}

// LedgerEntryPublic is a single balance movement.
type LedgerEntryPublic struct {
	ID            uuid.UUID  `json:"id"`
	TransactionID *uuid.UUID `json:"transaction_id,omitempty"`
	Type          string     `json:"type"` // PAYMENT | FEE | REFUND | ADJUSTMENT
	Amount        int64      `json:"amount"`
	Currency      string     `json:"currency"`
	Description   *string    `json:"description,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// SettlementPublic is the merchant-facing representation of a payout.
type SettlementPublic struct {
	ID            uuid.UUID  `json:"id"`
	Amount        int64      `json:"amount"`
	Currency      string     `json:"currency"`
	Status        string     `json:"status"` // PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED
	Method        string     `json:"method"` // AIRTEL | MOOV | BANK
	Destination   string     `json:"destination"`
	FailureReason *string    `json:"failure_reason,omitempty"`
	RequestedAt   time.Time  `json:"requested_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// CreateSettlementRequest is the payload to request a payout.
type CreateSettlementRequest struct {
	Amount      int64  `json:"amount" validate:"required,gt=0"`
	Method      string `json:"method" validate:"required"`      // AIRTEL | MOOV | BANK
	Destination string `json:"destination" validate:"required"` // phone or account
}

// SettlementListResponse is a paginated list of settlements.
type SettlementListResponse struct {
	Settlements []SettlementPublic `json:"settlements"`
	Total       int64              `json:"total"`
	Limit       int32              `json:"limit"`
	Offset      int32              `json:"offset"`
}
