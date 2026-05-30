package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// Enum types — mirroring PostgreSQL ENUM definitions
// =============================================================================

// TransactionStatus represents the lifecycle state of a transaction.
type TransactionStatus string

const (
	StatusPending    TransactionStatus = "PENDING"
	StatusProcessing TransactionStatus = "PROCESSING"
	StatusWaitingSMS TransactionStatus = "WAITING_SMS"
	StatusSuccess    TransactionStatus = "SUCCESS"
	StatusFailed     TransactionStatus = "FAILED"
	StatusTimeout    TransactionStatus = "TIMEOUT"
	StatusRefunded   TransactionStatus = "REFUNDED"
)

// AllTransactionStatuses returns all valid transaction statuses.
func AllTransactionStatuses() []TransactionStatus {
	return []TransactionStatus{
		StatusPending, StatusProcessing, StatusWaitingSMS,
		StatusSuccess, StatusFailed, StatusTimeout, StatusRefunded,
	}
}

// IsValid checks if the status is a recognized enum value.
func (s TransactionStatus) IsValid() bool {
	for _, v := range AllTransactionStatuses() {
		if s == v {
			return true
		}
	}
	return false
}

// IsFinal returns true if the transaction is in a terminal state
// and cannot transition further.
// Note: SUCCESS is NOT final — it can transition to REFUNDED.
func (s TransactionStatus) IsFinal() bool {
	switch s {
	case StatusFailed, StatusTimeout, StatusRefunded:
		return true
	default:
		return false
	}
}

// OperatorType represents a supported mobile money operator.
type OperatorType string

const (
	OperatorAirtel OperatorType = "AIRTEL"
	OperatorMoov   OperatorType = "MOOV"
)

// AllOperatorTypes returns all valid operator types.
func AllOperatorTypes() []OperatorType {
	return []OperatorType{OperatorAirtel, OperatorMoov}
}

// IsValid checks if the operator is a recognized enum value.
func (o OperatorType) IsValid() bool {
	return o == OperatorAirtel || o == OperatorMoov
}

// CurrencyType represents a supported currency.
type CurrencyType string

const (
	CurrencyXAF CurrencyType = "XAF"
)

// IsValid checks if the currency is a recognized enum value.
func (c CurrencyType) IsValid() bool {
	return c == CurrencyXAF
}

// =============================================================================
// Transaction model
// =============================================================================

// Transaction represents a mobile money payment flowing through the system.
// Amounts are ALWAYS in integer centimes XAF — never floats.
type Transaction struct {
	ID             uuid.UUID         `json:"id"`
	MerchantID     uuid.UUID         `json:"merchant_id"`
	Reference      string            `json:"reference"`
	InternalRef    string            `json:"internal_ref"`
	Amount         int64             `json:"amount"` // Centimes XAF — integer only
	Currency       CurrencyType      `json:"currency"`
	Operator       OperatorType      `json:"operator"`
	PhoneNumber    string            `json:"phone_number"`
	Description    *string           `json:"description,omitempty"`
	Status         TransactionStatus `json:"status"`
	GatewayID      *string           `json:"gateway_id,omitempty"`
	USSDSessionID  *string           `json:"ussd_session_id,omitempty"`
	SMSRaw         *string           `json:"-"` // Audit only — never in API responses
	FailureReason  *string           `json:"failure_reason,omitempty"`
	WebhookSent    bool              `json:"webhook_sent"`
	WebhookAttempts int              `json:"webhook_attempts"`
	InitiatedAt    time.Time         `json:"initiated_at"`
	ConfirmedAt    *time.Time        `json:"confirmed_at,omitempty"`
	ExpiresAt      time.Time         `json:"expires_at"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// =============================================================================
// Request / Response DTOs
// =============================================================================

// CreateTransactionRequest is the payload for initiating a new payment.
type CreateTransactionRequest struct {
	Reference   string       `json:"reference" validate:"required,max=100"`
	Amount      int64        `json:"amount" validate:"required,gt=0"`
	Currency    CurrencyType `json:"currency" validate:"required"`
	Operator    OperatorType `json:"operator" validate:"required"`
	PhoneNumber string       `json:"phone_number" validate:"required,max=20"`
	Description string       `json:"description,omitempty" validate:"max=255"`

	// PaymentLinkID is set internally when a transaction originates from a
	// hosted-checkout payment link. Never populated from the public JSON body.
	PaymentLinkID *uuid.UUID `json:"-"`
}

// Validate performs business rule validation beyond struct tags.
func (r *CreateTransactionRequest) Validate() error {
	if !r.Currency.IsValid() {
		return fmt.Errorf("unsupported currency: %s", r.Currency)
	}
	if !r.Operator.IsValid() {
		return fmt.Errorf("unsupported operator: %s", r.Operator)
	}
	if r.Amount <= 0 {
		return fmt.Errorf("amount must be a positive integer (centimes XAF)")
	}
	return nil
}

// CreateTransactionResponse is the minimal response after initiating a transaction.
type CreateTransactionResponse struct {
	ID          uuid.UUID         `json:"id"`
	InternalRef string            `json:"internal_ref"`
	Status      TransactionStatus `json:"status"`
	ExpiresAt   time.Time         `json:"expires_at"`
}

// TransactionListRequest holds pagination and filter parameters.
type TransactionListRequest struct {
	MerchantID uuid.UUID          `json:"-"`
	Status     *TransactionStatus `json:"status,omitempty"`
	Limit      int32              `json:"limit"`
	Offset     int32              `json:"offset"`
}

// TransactionListResponse is a paginated list of transactions.
type TransactionListResponse struct {
	Transactions []Transaction `json:"transactions"`
	Total        int64         `json:"total"`
	Limit        int32         `json:"limit"`
	Offset       int32         `json:"offset"`
}
