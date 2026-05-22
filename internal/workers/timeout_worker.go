package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/models"
)

// TimeoutHandler processes transaction expiry tasks.
// Scans for PENDING/PROCESSING transactions past their expires_at
// and transitions them to TIMEOUT with an audit log entry.
type TimeoutHandler struct {
	pool        *pgxpool.Pool
	queries     *db.Queries
	asynqClient *asynq.Client
	logger      *zap.Logger
}

// NewTimeoutHandler creates a new transaction timeout handler.
func NewTimeoutHandler(pool *pgxpool.Pool, asynqClient *asynq.Client, logger *zap.Logger) *TimeoutHandler {
	return &TimeoutHandler{
		pool:        pool,
		queries:     db.New(pool),
		asynqClient: asynqClient,
		logger:      logger.Named("timeout-worker"),
	}
}

// ProcessTask scans and expires all timed-out transactions.
// Called periodically every 60 seconds by the Asynq scheduler.
func (h *TimeoutHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	h.logger.Debug("running transaction timeout scan")

	// Fetch all expired transactions (PENDING or PROCESSING past expires_at).
	expired, err := h.queries.ListExpiredTransactions(ctx)
	if err != nil {
		return fmt.Errorf("listing expired transactions: %w", err)
	}

	if len(expired) == 0 {
		h.logger.Debug("no expired transactions found")
		return nil
	}

	h.logger.Info("found expired transactions",
		zap.Int("count", len(expired)),
	)

	// Process each expired transaction individually.
	// If one fails, the others still get processed.
	var processedCount int
	for _, txn := range expired {
		if err := h.expireTransaction(ctx, txn); err != nil {
			h.logger.Error("failed to expire transaction",
				zap.String("transaction_id", txn.ID.String()),
				zap.Error(err),
			)
			continue
		}
		processedCount++
	}

	h.logger.Info("timeout scan completed",
		zap.Int("total", len(expired)),
		zap.Int("processed", processedCount),
	)

	return nil
}

// expireTransaction transitions a single transaction to TIMEOUT status
// within a database transaction (atomic status update + audit log).
// Uses the guarded ExpireTransaction query — if the transaction was already
// confirmed (SUCCESS) between the scan and this update, no rows are affected.
func (h *TimeoutHandler) expireTransaction(ctx context.Context, txn db.Transaction) error {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := h.queries.WithTx(tx)

	// SQL-level guard: WHERE status IN ('PENDING', 'PROCESSING')
	// If the status already changed (e.g., SUCCESS via SMS), this returns
	// pgx.ErrNoRows — we skip silently instead of corrupting data.
	failureReason := "TRANSACTION_TIMEOUT"
	_, err = qtx.ExpireTransaction(ctx, db.ExpireTransactionParams{
		ID:            txn.ID,
		FailureReason: &failureReason,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Transaction already moved to a final state — skip.
			h.logger.Info("transaction already finalized, skipping timeout",
				zap.String("transaction_id", txn.ID.String()),
				zap.String("current_status", string(txn.Status)),
			)
			return nil
		}
		return fmt.Errorf("expiring transaction: %w", err)
	}

	// Audit log — every status change must produce an audit entry (PRD rule #6).
	auditPayload, _ := json.Marshal(map[string]string{
		"from":   string(txn.Status),
		"to":     "TIMEOUT",
		"reason": failureReason,
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TransactionID: &txn.ID,
		MerchantID:    &txn.MerchantID,
		EventType:     models.AuditEventTransactionTimeout,
		Payload:       auditPayload,
	})
	if err != nil {
		return fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing: %w", err)
	}

	// Enqueue webhook dispatch for TIMEOUT event.
	h.enqueueTimeoutWebhook(txn.ID, txn.MerchantID)

	h.logger.Info("transaction expired",
		zap.String("transaction_id", txn.ID.String()),
		zap.String("previous_status", string(txn.Status)),
	)

	return nil
}

// enqueueTimeoutWebhook enqueues a webhook delivery for a timed-out transaction.
func (h *TimeoutHandler) enqueueTimeoutWebhook(txID, merchantID uuid.UUID) {
	payload, _ := json.Marshal(map[string]string{
		"transaction_id": txID.String(),
		"merchant_id":    merchantID.String(),
		"event_type":     models.WebhookEventTransactionTimeout,
	})

	task := asynq.NewTask(TypeWebhookDeliver, payload)
	_, err := h.asynqClient.Enqueue(task,
		asynq.Queue("webhooks"),
		asynq.MaxRetry(4),
	)
	if err != nil {
		h.logger.Error("failed to enqueue timeout webhook",
			zap.String("transaction_id", txID.String()),
			zap.Error(err),
		)
	}
}
