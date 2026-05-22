package models

import (
	"time"

	"github.com/google/uuid"
)

// WebhookEndpoint represents a merchant's configured webhook URL
// where transaction event notifications are dispatched.
type WebhookEndpoint struct {
	ID         uuid.UUID `json:"id"`
	MerchantID uuid.UUID `json:"merchant_id"`
	URL        string    `json:"url"`
	Secret     string    `json:"-"` // HMAC signing secret — never in API responses
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

// CreateWebhookRequest is the payload for registering a new webhook endpoint.
type CreateWebhookRequest struct {
	URL string `json:"url" validate:"required,url,max=500"`
}

// WebhookEndpointResponse is the safe representation for API responses.
type WebhookEndpointResponse struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateWebhookResponse includes the signing secret, shown only once.
type CreateWebhookResponse struct {
	ID        uuid.UUID `json:"id"`
	URL       string    `json:"url"`
	Secret    string    `json:"secret"` // Shown ONCE at creation
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// WebhookEvent is the payload dispatched to merchant webhook URLs.
// Signed with HMAC-SHA256 via X-Kadryza-Signature header.
type WebhookEvent struct {
	Event     string           `json:"event"`
	Data      WebhookEventData `json:"data"`
	Timestamp time.Time        `json:"timestamp"`
}

// WebhookEventData contains transaction details sent in a webhook.
type WebhookEventData struct {
	ID          uuid.UUID         `json:"id"`
	Reference   string            `json:"reference"`
	Amount      int64             `json:"amount"`
	Currency    CurrencyType      `json:"currency"`
	Operator    OperatorType      `json:"operator"`
	PhoneNumber string            `json:"phone_number"`
	Status      TransactionStatus `json:"status"`
	ConfirmedAt *time.Time        `json:"confirmed_at,omitempty"`
}

// Webhook event type constants.
const (
	WebhookEventTransactionSuccess = "transaction.success"
	WebhookEventTransactionFailed  = "transaction.failed"
	WebhookEventTransactionTimeout = "transaction.timeout"
)
