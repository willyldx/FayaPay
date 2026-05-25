package models

import (
	"time"

	"github.com/google/uuid"
)

// AuditLog is an immutable record of a system event.
// This table is INSERT-ONLY — no updates or deletes ever.
// Every transaction status change MUST produce an audit log entry.
type AuditLog struct {
	ID            uuid.UUID  `json:"id"`
	TransactionID *uuid.UUID `json:"transaction_id,omitempty"`
	MerchantID    *uuid.UUID `json:"merchant_id,omitempty"`
	EventType     string     `json:"event_type"`
	Payload       any        `json:"payload,omitempty"` // JSONB — arbitrary event data
	CreatedAt     time.Time  `json:"created_at"`
}

// Audit event type constants.
const (
	AuditEventTransactionInitiated = "TRANSACTION_INITIATED"
	AuditEventTransactionProcessing = "TRANSACTION_PROCESSING"
	AuditEventUSSDStarted          = "USSD_STARTED"
	AuditEventSMSReceived          = "SMS_RECEIVED"
	AuditEventTransactionSuccess   = "TRANSACTION_SUCCESS"
	AuditEventTransactionFailed    = "TRANSACTION_FAILED"
	AuditEventTransactionTimeout   = "TRANSACTION_TIMEOUT"
	AuditEventWebhookSent          = "WEBHOOK_SENT"
	AuditEventWebhookFailed        = "WEBHOOK_FAILED"
	AuditEventMerchantCreated      = "MERCHANT_CREATED"
	AuditEventAPIKeyGenerated      = "API_KEY_GENERATED"
	AuditEventAPIKeyRevoked        = "API_KEY_REVOKED"
	AuditEventGatewayConnected     = "GATEWAY_CONNECTED"
	AuditEventGatewayDisconnected  = "GATEWAY_DISCONNECTED"
	AuditEventEmailVerified        = "EMAIL_VERIFIED"
	AuditEventVerificationSent     = "VERIFICATION_EMAIL_SENT"
	AuditEventPasswordReset        = "PASSWORD_RESET"
)
