package models

import (
	"time"

	"github.com/google/uuid"
)

// PaymentLinkPublic is the dashboard-facing representation of a payment link.
type PaymentLinkPublic struct {
	ID          uuid.UUID  `json:"id"`
	Slug        string     `json:"slug"`
	Amount      int64      `json:"amount"`
	Currency    string     `json:"currency"`
	Description *string    `json:"description,omitempty"`
	IsActive    bool       `json:"is_active"`
	IsReusable  bool       `json:"is_reusable"`
	SuccessURL  *string    `json:"success_url,omitempty"`
	PaidCount   int32      `json:"paid_count"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	URL         string     `json:"url"` // full public checkout URL
	CreatedAt   time.Time  `json:"created_at"`
}

// CreatePaymentLinkRequest is the payload to create a payment link.
type CreatePaymentLinkRequest struct {
	Amount      int64      `json:"amount" validate:"required,gt=0"`
	Description string     `json:"description" validate:"max=255"`
	IsReusable  *bool      `json:"is_reusable"`
	SuccessURL  string     `json:"success_url" validate:"omitempty,url,max=500"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

// PaymentLinkListResponse is a paginated list of payment links.
type PaymentLinkListResponse struct {
	PaymentLinks []PaymentLinkPublic `json:"payment_links"`
	Total        int64               `json:"total"`
	Limit        int32               `json:"limit"`
	Offset       int32               `json:"offset"`
}

// CheckoutView is the public, payer-facing view of a payment link
// (no merchant internals beyond the display name).
type CheckoutView struct {
	Slug         string  `json:"slug"`
	Amount       int64   `json:"amount"`
	Currency     string  `json:"currency"`
	Description  *string `json:"description,omitempty"`
	MerchantName string  `json:"merchant_name"`
	IsPayable    bool    `json:"is_payable"` // active AND not expired
}

// CheckoutPayRequest is the payer's input on the hosted checkout page.
type CheckoutPayRequest struct {
	PhoneNumber string `json:"phone_number" validate:"required"`
	Operator    string `json:"operator" validate:"required"`
}

// CheckoutTransactionStatus is the minimal, public status of a checkout payment
// (used for polling on the hosted checkout page).
type CheckoutTransactionStatus struct {
	ID            uuid.UUID `json:"id"`
	Status        string    `json:"status"`
	Amount        int64     `json:"amount"`
	FailureReason *string   `json:"failure_reason,omitempty"`
}
