package workers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/models"
)

// webhookTaskPayload is the JSON structure stored in the Asynq task.
// Must match the payload marshaled by WebhookService.DispatchEvent.
type webhookTaskPayload struct {
	EndpointID    string `json:"endpoint_id"`
	TransactionID string `json:"transaction_id"`
	MerchantID    string `json:"merchant_id"`
	EventType     string `json:"event_type"`
}

// WebhookHandler processes webhook delivery tasks from the Asynq queue.
type WebhookHandler struct {
	pool       *pgxpool.Pool
	queries    *db.Queries
	httpClient *http.Client
	logger     *zap.Logger
}

// NewWebhookHandler creates a new webhook delivery handler.
func NewWebhookHandler(pool *pgxpool.Pool, webhookTimeoutSec int, logger *zap.Logger) *WebhookHandler {
	return &WebhookHandler{
		pool:    pool,
		queries: db.New(pool),
		httpClient: &http.Client{
			Timeout: time.Duration(webhookTimeoutSec) * time.Second,
		},
		logger: logger.Named("webhook-worker"),
	}
}

// ProcessTask handles a single webhook:deliver task.
// If it returns an error, Asynq will retry with the configured backoff.
func (h *WebhookHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	// Parse task payload.
	var payload webhookTaskPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		// Permanent failure — don't retry malformed payloads.
		h.logger.Error("invalid webhook task payload", zap.Error(err))
		return fmt.Errorf("unmarshal payload: %w (skip retry)", err)
	}

	endpointID, err := uuid.Parse(payload.EndpointID)
	if err != nil {
		return fmt.Errorf("invalid endpoint_id: %w", err)
	}
	txID, err := uuid.Parse(payload.TransactionID)
	if err != nil {
		return fmt.Errorf("invalid transaction_id: %w", err)
	}
	merchantID, err := uuid.Parse(payload.MerchantID)
	if err != nil {
		return fmt.Errorf("invalid merchant_id: %w", err)
	}

	h.logger.Info("processing webhook delivery",
		zap.String("endpoint_id", payload.EndpointID),
		zap.String("transaction_id", payload.TransactionID),
		zap.String("event_type", payload.EventType),
	)

	// ---- Fetch endpoint (URL + signing secret) ----
	endpoint, err := h.queries.GetWebhookEndpointByID(ctx, endpointID)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Endpoint deleted — skip silently, no retry.
			h.logger.Info("webhook endpoint deleted — skipping", zap.String("endpoint_id", payload.EndpointID))
			return nil
		}
		return fmt.Errorf("fetching endpoint: %w", err)
	}
	if endpoint.IsActive != nil && !*endpoint.IsActive {
		h.logger.Info("webhook endpoint inactive — skipping", zap.String("endpoint_id", payload.EndpointID))
		return nil
	}

	// ---- Fetch transaction for payload data ----
	txn, err := h.queries.GetTransactionByID(ctx, txID)
	if err != nil {
		return fmt.Errorf("fetching transaction: %w", err)
	}

	// ---- Build the webhook event body ----
	event := models.WebhookEvent{
		Event: payload.EventType,
		Data: models.WebhookEventData{
			ID:          txn.ID,
			Reference:   txn.Reference,
			Amount:      txn.Amount,
			Currency:    models.CurrencyType(fmt.Sprint(txn.Currency)),
			Operator:    models.OperatorType(fmt.Sprint(txn.Operator)),
			PhoneNumber: txn.PhoneNumber,
			Status:      models.TransactionStatus(fmt.Sprint(txn.Status)),
			ConfirmedAt: txn.ConfirmedAt,
		},
		Timestamp: time.Now().UTC(),
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshaling event: %w", err)
	}

	// ---- Sign with HMAC-SHA256 ----
	signature := hmacSign(body, endpoint.Secret)

	// ---- HTTP POST to merchant URL ----
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.Url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Kadryza-Signature", "sha256="+signature)
	req.Header.Set("User-Agent", "Kadryza-Webhook/1.0")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		// Network error — increment attempts, Asynq will retry.
		h.queries.IncrementWebhookAttempts(ctx, txID) //nolint:errcheck
		h.logAuditWebhookFailed(ctx, txID, merchantID, err.Error())
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	// FIX M8: Drain response body to enable TCP connection reuse.
	defer func() {
		io.Copy(io.Discard, resp.Body) //nolint:errcheck
		resp.Body.Close()
	}()

	// ---- Handle response ----
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Non-2xx — increment attempts, Asynq will retry.
		h.queries.IncrementWebhookAttempts(ctx, txID) //nolint:errcheck
		reason := fmt.Sprintf("HTTP %d from %s", resp.StatusCode, endpoint.Url)
		h.logAuditWebhookFailed(ctx, txID, merchantID, reason)
		return fmt.Errorf("webhook returned HTTP %d", resp.StatusCode)
	}

	// ---- Success — mark as sent ----
	h.queries.MarkWebhookSent(ctx, txID) //nolint:errcheck

	// Audit log — successful delivery.
	auditPayload, _ := json.Marshal(map[string]interface{}{
		"endpoint_url": endpoint.Url,
		"status_code":  resp.StatusCode,
		"event_type":   payload.EventType,
	})
	h.queries.CreateAuditLog(ctx, db.CreateAuditLogParams{ //nolint:errcheck
		TransactionID: &txID,
		MerchantID:    merchantID,
		EventType:     models.AuditEventWebhookSent,
		Payload:       auditPayload,
	})

	h.logger.Info("webhook delivered successfully",
		zap.String("endpoint_id", payload.EndpointID),
		zap.String("transaction_id", payload.TransactionID),
		zap.Int("status_code", resp.StatusCode),
	)

	return nil
}

// logAuditWebhookFailed records a failed webhook delivery attempt.
func (h *WebhookHandler) logAuditWebhookFailed(ctx context.Context, txID, merchantID uuid.UUID, reason string) {
	auditPayload, _ := json.Marshal(map[string]string{
		"reason": reason,
	})
	h.queries.CreateAuditLog(ctx, db.CreateAuditLogParams{ //nolint:errcheck
		TransactionID: &txID,
		MerchantID:    merchantID,
		EventType:     models.AuditEventWebhookFailed,
		Payload:       auditPayload,
	})
}

// hmacSign computes HMAC-SHA256 of the body using the secret.
func hmacSign(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// WebhookRetryDelay implements the PRD's exponential backoff:
// Attempt 1 → 1 min, Attempt 2 → 5 min, Attempt 3 → 30 min, Attempt 4 → 2 hours.
func WebhookRetryDelay(n int, _ error, _ *asynq.Task) time.Duration {
	delays := []time.Duration{
		1 * time.Minute,
		5 * time.Minute,
		30 * time.Minute,
		2 * time.Hour,
	}
	if n <= 0 {
		return delays[0]
	}
	if n > len(delays) {
		return delays[len(delays)-1]
	}
	return delays[n-1]
}
