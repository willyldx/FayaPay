package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/fayapay/faya-backend/internal/config"
	db "github.com/fayapay/faya-backend/internal/db/sqlc"
	"github.com/fayapay/faya-backend/internal/models"
	"github.com/fayapay/faya-backend/internal/workers"
	"github.com/fayapay/faya-backend/pkg/crypto"
)

// =============================================================================
// Errors
// =============================================================================

var (
	ErrWebhookEndpointNotFound = errors.New("webhook endpoint not found")
	ErrWebhookDeliveryFailed   = errors.New("webhook delivery failed")
)

// =============================================================================
// Service
// =============================================================================

// WebhookService manages webhook endpoint CRUD and event dispatch.
type WebhookService struct {
	pool        *pgxpool.Pool
	queries     *db.Queries
	asynqClient *asynq.Client
	config      *config.Config
	httpClient  *http.Client
	logger      *zap.Logger
}

// NewWebhookService creates a new WebhookService.
func NewWebhookService(
	pool *pgxpool.Pool,
	asynqClient *asynq.Client,
	cfg *config.Config,
	logger *zap.Logger,
) *WebhookService {
	return &WebhookService{
		pool:        pool,
		queries:     db.New(pool),
		asynqClient: asynqClient,
		config:      cfg,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.WebhookTimeoutSeconds) * time.Second,
		},
		logger: logger.Named("webhook-svc"),
	}
}

// =============================================================================
// CRUD operations
// =============================================================================

// Create registers a new webhook endpoint for a merchant.
// Generates a random HMAC signing secret, returned ONCE in the response.
func (s *WebhookService) Create(
	ctx context.Context,
	merchantID uuid.UUID,
	req models.CreateWebhookRequest,
) (*models.CreateWebhookResponse, error) {

	// Generate a signing secret for this endpoint.
	secret, err := crypto.GenerateWebhookSecret()
	if err != nil {
		return nil, fmt.Errorf("generating webhook secret: %w", err)
	}

	endpoint, err := s.queries.CreateWebhookEndpoint(ctx, db.CreateWebhookEndpointParams{
		MerchantID: merchantID,
		Url:        req.URL,
		Secret:     secret,
	})
	if err != nil {
		return nil, fmt.Errorf("creating webhook endpoint: %w", err)
	}

	s.logger.Info("webhook endpoint created",
		zap.String("endpoint_id", endpoint.ID.String()),
		zap.String("merchant_id", merchantID.String()),
		zap.String("url", req.URL),
	)

	return &models.CreateWebhookResponse{
		ID:        endpoint.ID,
		URL:       endpoint.Url,
		Secret:    secret, // Shown ONCE.
		IsActive:  endpoint.IsActive,
		CreatedAt: endpoint.CreatedAt,
	}, nil
}

// ListByMerchant returns all webhook endpoints for a merchant.
func (s *WebhookService) ListByMerchant(ctx context.Context, merchantID uuid.UUID) ([]models.WebhookEndpointResponse, error) {
	endpoints, err := s.queries.ListWebhookEndpointsByMerchant(ctx, merchantID)
	if err != nil {
		return nil, fmt.Errorf("listing webhook endpoints: %w", err)
	}

	result := make([]models.WebhookEndpointResponse, len(endpoints))
	for i, ep := range endpoints {
		result[i] = models.WebhookEndpointResponse{
			ID:        ep.ID,
			URL:       ep.Url,
			IsActive:  ep.IsActive,
			CreatedAt: ep.CreatedAt,
		}
	}

	return result, nil
}

// Delete removes a webhook endpoint. Verifies ownership via merchant_id.
func (s *WebhookService) Delete(ctx context.Context, merchantID, endpointID uuid.UUID) error {
	err := s.queries.DeleteWebhookEndpoint(ctx, db.DeleteWebhookEndpointParams{
		ID:         endpointID,
		MerchantID: merchantID,
	})
	if err != nil {
		return fmt.Errorf("deleting webhook endpoint: %w", err)
	}

	s.logger.Info("webhook endpoint deleted",
		zap.String("endpoint_id", endpointID.String()),
	)

	return nil
}

// =============================================================================
// Dispatch — enqueue webhook delivery via Asynq
// =============================================================================

// DispatchEvent enqueues webhook delivery tasks for all active endpoints of a merchant.
// Called by the transaction service when a transaction reaches a terminal state.
func (s *WebhookService) DispatchEvent(
	ctx context.Context,
	merchantID uuid.UUID,
	txn *models.Transaction,
) error {
	// Get all active webhook endpoints for this merchant.
	endpoints, err := s.queries.GetActiveWebhooksByMerchant(ctx, merchantID)
	if err != nil {
		return fmt.Errorf("fetching active webhooks: %w", err)
	}

	if len(endpoints) == 0 {
		s.logger.Debug("no active webhook endpoints — skipping dispatch",
			zap.String("merchant_id", merchantID.String()),
		)
		return nil
	}

	// Determine event type based on transaction status.
	eventType := statusToEventType(txn.Status)

	// Enqueue a delivery task for each endpoint.
	for _, ep := range endpoints {
		payload, _ := json.Marshal(WebhookTaskPayload{
			EndpointID:    ep.ID.String(),
			TransactionID: txn.ID.String(),
			MerchantID:    merchantID.String(),
			EventType:     eventType,
		})

		task := asynq.NewTask(workers.TypeWebhookDeliver, payload)

		// FIX M1: TaskID prevents duplicate webhooks if DispatchEvent
		// is called twice for the same endpoint+transaction (race).
		taskID := fmt.Sprintf("wh:%s:%s", ep.ID, txn.ID)

		// PRD rule #3: retry with exponential backoff — 1min, 5min, 30min, 2h.
		// Max 4 attempts total.
		_, err := s.asynqClient.Enqueue(task,
			asynq.Queue("webhooks"),
			asynq.MaxRetry(4),
			asynq.Retention(24*time.Hour),
			asynq.TaskID(taskID),
		)
		if err != nil {
			s.logger.Error("failed to enqueue webhook delivery",
				zap.String("endpoint_id", ep.ID.String()),
				zap.String("transaction_id", txn.ID.String()),
				zap.Error(err),
			)
			continue
		}

		s.logger.Info("webhook delivery enqueued",
			zap.String("endpoint_id", ep.ID.String()),
			zap.String("transaction_id", txn.ID.String()),
			zap.String("event_type", eventType),
		)
	}

	return nil
}

// =============================================================================
// Deliver — actually send the webhook HTTP POST
// =============================================================================

// DeliverWebhook performs the actual HTTP POST to a webhook endpoint.
// This is called by the Asynq worker, not directly by handlers.
// Returns an error if delivery fails — Asynq will retry with backoff.
func (s *WebhookService) DeliverWebhook(ctx context.Context, taskPayload WebhookTaskPayload) error {
	// Parse IDs.
	endpointID, err := uuid.Parse(taskPayload.EndpointID)
	if err != nil {
		return fmt.Errorf("invalid endpoint_id: %w", err)
	}
	txID, err := uuid.Parse(taskPayload.TransactionID)
	if err != nil {
		return fmt.Errorf("invalid transaction_id: %w", err)
	}

	// Fetch the endpoint (need URL and signing secret).
	endpoint, err := s.queries.GetWebhookEndpointByID(ctx, endpointID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Endpoint was deleted — skip silently, don't retry.
			return nil
		}
		return fmt.Errorf("fetching endpoint: %w", err)
	}

	if !endpoint.IsActive {
		return nil // Deactivated — skip.
	}

	// Fetch the transaction for the payload data.
	txn, err := s.queries.GetTransactionByID(ctx, txID)
	if err != nil {
		return fmt.Errorf("fetching transaction: %w", err)
	}

	// Build the webhook event payload.
	event := models.WebhookEvent{
		Event: taskPayload.EventType,
		Data: models.WebhookEventData{
			ID:          txn.ID,
			Reference:   txn.Reference,
			Amount:      txn.Amount,
			Currency:    models.CurrencyType(txn.Currency),
			Operator:    models.OperatorType(txn.Operator),
			PhoneNumber: txn.PhoneNumber,
			Status:      models.TransactionStatus(txn.Status),
			ConfirmedAt: txn.ConfirmedAt,
		},
		Timestamp: time.Now().UTC(),
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshaling webhook payload: %w", err)
	}

	// Sign the payload with HMAC-SHA256 using the endpoint's secret.
	signature := signPayload(body, endpoint.Secret)

	// Send the HTTP POST.
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.Url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Faya-Signature", "sha256="+signature)
	req.Header.Set("User-Agent", "FayaPay-Webhook/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Increment attempt counter.
		s.queries.IncrementWebhookAttempts(ctx, txID) //nolint:errcheck
		return fmt.Errorf("%w: %v", ErrWebhookDeliveryFailed, err)
	}
	defer resp.Body.Close()

	// Any non-2xx response is a failure — Asynq will retry.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		s.queries.IncrementWebhookAttempts(ctx, txID) //nolint:errcheck
		return fmt.Errorf("%w: received HTTP %d from %s", ErrWebhookDeliveryFailed, resp.StatusCode, endpoint.Url)
	}

	// Success — mark webhook as sent.
	s.queries.MarkWebhookSent(ctx, txID) //nolint:errcheck

	s.logger.Info("webhook delivered successfully",
		zap.String("endpoint_id", endpointID.String()),
		zap.String("transaction_id", txID.String()),
		zap.Int("status_code", resp.StatusCode),
	)

	return nil
}

// =============================================================================
// Test — send a test webhook to verify endpoint connectivity
// =============================================================================

// TestEndpoint sends a test payload to a webhook endpoint to verify it's reachable.
func (s *WebhookService) TestEndpoint(ctx context.Context, merchantID, endpointID uuid.UUID) error {
	endpoint, err := s.queries.GetWebhookEndpointByID(ctx, endpointID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrWebhookEndpointNotFound
		}
		return fmt.Errorf("fetching endpoint: %w", err)
	}

	// Ownership check.
	if endpoint.MerchantID != merchantID {
		return ErrWebhookEndpointNotFound
	}

	// Build a test event.
	testEvent := models.WebhookEvent{
		Event: "transaction.test",
		Data: models.WebhookEventData{
			ID:          uuid.New(),
			Reference:   "test_reference_001",
			Amount:      1000,
			Currency:    models.CurrencyXAF,
			Operator:    models.OperatorAirtel,
			PhoneNumber: "+23566000000",
			Status:      models.StatusSuccess,
		},
		Timestamp: time.Now().UTC(),
	}

	body, _ := json.Marshal(testEvent)
	signature := signPayload(body, endpoint.Secret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.Url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating test request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Faya-Signature", "sha256="+signature)
	req.Header.Set("User-Agent", "FayaPay-Webhook/1.0")
	req.Header.Set("X-Faya-Test", "true")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("test webhook failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("test webhook returned HTTP %d", resp.StatusCode)
	}

	return nil
}

// =============================================================================
// Shared types and helpers
// =============================================================================

// WebhookTaskPayload is the JSON payload stored in the Asynq task for webhook delivery.
type WebhookTaskPayload struct {
	EndpointID    string `json:"endpoint_id"`
	TransactionID string `json:"transaction_id"`
	MerchantID    string `json:"merchant_id"`
	EventType     string `json:"event_type"`
}

// signPayload computes HMAC-SHA256 of the payload body using the secret.
func signPayload(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// statusToEventType maps a terminal transaction status to the webhook event type string.
func statusToEventType(status models.TransactionStatus) string {
	switch status {
	case models.StatusSuccess:
		return models.WebhookEventTransactionSuccess
	case models.StatusFailed:
		return models.WebhookEventTransactionFailed
	case models.StatusTimeout:
		return models.WebhookEventTransactionTimeout
	default:
		return "transaction.unknown"
	}
}

// RetryDelay implements the PRD's exponential backoff schedule for webhook retries.
// Retry 1: 1 min, Retry 2: 5 min, Retry 3: 30 min, Retry 4: 2 hours.
func RetryDelay(n int, _ error, _ *asynq.Task) time.Duration {
	switch n {
	case 1:
		return 1 * time.Minute
	case 2:
		return 5 * time.Minute
	case 3:
		return 30 * time.Minute
	case 4:
		return 2 * time.Hour
	default:
		return 2 * time.Hour
	}
}
