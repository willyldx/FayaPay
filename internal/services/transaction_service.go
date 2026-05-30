package services

import (
	"context"
	crypto_rand "crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/gateway"
	"github.com/kadryza/kadryza-backend/internal/models"
	"github.com/kadryza/kadryza-backend/internal/workers"
)

// =============================================================================
// Errors
// =============================================================================

var (
	ErrTransactionNotFound   = errors.New("transaction not found")
	ErrDuplicateReference    = errors.New("transaction with this reference already exists")
	ErrInvalidStatusTransition = errors.New("invalid status transition")
	ErrTransactionFinalized  = errors.New("transaction is in a final state")
	ErrNoGatewayAvailable    = errors.New("no gateway available for this operator")
)

// =============================================================================
// Service
// =============================================================================

// TransactionService handles the full lifecycle of mobile money transactions.
type TransactionService struct {
	pool        *pgxpool.Pool
	queries     *db.Queries
	hub         *gateway.Hub
	asynqClient *asynq.Client
	logger      *zap.Logger
}

// NewTransactionService creates a new TransactionService.
func NewTransactionService(
	pool *pgxpool.Pool,
	hub *gateway.Hub,
	asynqClient *asynq.Client,
	logger *zap.Logger,
) *TransactionService {
	return &TransactionService{
		pool:        pool,
		queries:     db.New(pool),
		hub:         hub,
		asynqClient: asynqClient,
		logger:      logger.Named("transaction-svc"),
	}
}

// =============================================================================
// Initiate — create a new transaction
// =============================================================================

// Initiate creates a new mobile money transaction.
// Implements idempotency: if a transaction with the same reference already exists
// for this merchant, the existing transaction is returned without creating a duplicate.
func (s *TransactionService) Initiate(
	ctx context.Context,
	merchantID uuid.UUID,
	req models.CreateTransactionRequest,
) (*models.CreateTransactionResponse, error) {

	// Validate business rules.
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation: %w", err)
	}

	// --- Idempotency check (PRD rule #1) ---
	existing, err := s.queries.GetTransactionByReference(ctx, db.GetTransactionByReferenceParams{
		Reference:  req.Reference,
		MerchantID: merchantID,
	})
	if err == nil {
		// Transaction already exists — return it (idempotent).
		s.logger.Info("idempotent request — returning existing transaction",
			zap.String("reference", req.Reference),
			zap.String("transaction_id", existing.ID.String()),
		)
		return &models.CreateTransactionResponse{
			ID:          existing.ID,
			InternalRef: existing.InternalRef,
			Status:      models.TransactionStatus(fmt.Sprint(existing.Status)),
			ExpiresAt:   existing.ExpiresAt,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("checking idempotency: %w", err)
	}

	// --- Generate internal reference ---
	internalRef := generateInternalRef()

	// --- Create transaction + audit log atomically ---
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	// Determine description pointer.
	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	txn, err := qtx.CreateTransaction(ctx, db.CreateTransactionParams{
		MerchantID:  merchantID,
		Reference:   req.Reference,
		InternalRef: internalRef,
		Amount:      req.Amount,
		Currency:    string(req.Currency),
		Operator:    string(req.Operator),
		PhoneNumber: req.PhoneNumber,
		Description: description,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicateReference
		}
		return nil, fmt.Errorf("creating transaction: %w", err)
	}

	// Audit log — TRANSACTION_INITIATED.
	auditPayload, _ := json.Marshal(map[string]interface{}{
		"reference":    req.Reference,
		"amount":       req.Amount,
		"operator":     req.Operator,
		"phone_number": req.PhoneNumber,
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TransactionID: &txn.ID,
		MerchantID:    merchantID,
		EventType:     models.AuditEventTransactionInitiated,
		Payload:       auditPayload,
	})
	if err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	// --- Dispatch to gateway via WebSocket Hub ---
	// This is async — if no gateway is available, the transaction stays PENDING
	// and will eventually timeout via the timeout worker.
	// FIX M6: Add context timeout to prevent goroutine leak if Hub blocks.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		s.dispatchToGateway(ctx, txn)
	}()

	s.logger.Info("transaction initiated",
		zap.String("transaction_id", txn.ID.String()),
		zap.String("internal_ref", internalRef),
		zap.String("operator", fmt.Sprint(txn.Operator)),
		zap.Int64("amount", txn.Amount),
	)

	return &models.CreateTransactionResponse{
		ID:          txn.ID,
		InternalRef: txn.InternalRef,
		Status:      models.TransactionStatus(fmt.Sprint(txn.Status)),
		ExpiresAt:   txn.ExpiresAt,
	}, nil
}

// =============================================================================
// GetByID — retrieve a transaction with ownership check
// =============================================================================

// GetByID retrieves a transaction by ID, verifying it belongs to the given merchant.
func (s *TransactionService) GetByID(ctx context.Context, merchantID, txID uuid.UUID) (*models.Transaction, error) {
	txn, err := s.queries.GetTransactionByID(ctx, txID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("querying transaction: %w", err)
	}

	// Ownership check — a merchant can only see their own transactions.
	if txn.MerchantID != merchantID {
		return nil, ErrTransactionNotFound
	}

	return toTransactionModel(txn), nil
}

// =============================================================================
// List — paginated transaction list
// =============================================================================

// List returns a paginated list of transactions for a merchant.
func (s *TransactionService) List(ctx context.Context, req models.TransactionListRequest) (*models.TransactionListResponse, error) {
	// Enforce sane defaults.
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	txns, err := s.queries.ListTransactionsByMerchant(ctx, db.ListTransactionsByMerchantParams{
		MerchantID: req.MerchantID,
		Limit:      req.Limit,
		Offset:     req.Offset,
	})
	if err != nil {
		return nil, fmt.Errorf("listing transactions: %w", err)
	}

	total, err := s.queries.CountTransactionsByMerchant(ctx, req.MerchantID)
	if err != nil {
		return nil, fmt.Errorf("counting transactions: %w", err)
	}

	result := make([]models.Transaction, len(txns))
	for i, t := range txns {
		result[i] = *toTransactionModel(t)
	}

	return &models.TransactionListResponse{
		Transactions: result,
		Total:        total,
		Limit:        req.Limit,
		Offset:       req.Offset,
	}, nil
}

// =============================================================================
// UpdateStatus — transition the transaction state machine
// =============================================================================

// UpdateStatus transitions a transaction to a new status.
// Uses SQL-level atomic guard (WHERE status NOT IN final states) to prevent
// TOCTOU race conditions between the gateway SMS handler and timeout worker.
func (s *TransactionService) UpdateStatus(
	ctx context.Context,
	txID uuid.UUID,
	newStatus models.TransactionStatus,
	reason *string,
) (*models.Transaction, error) {

	// Fetch current transaction — for validation + audit log "from" field.
	txn, err := s.queries.GetTransactionByID(ctx, txID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("querying transaction: %w", err)
	}

	currentStatus := models.TransactionStatus(fmt.Sprint(txn.Status))

	// Go-level validation — provides clear error messages.
	// (The SQL WHERE clause is the actual safety net against races.)
	if currentStatus.IsFinal() && newStatus != models.StatusRefunded {
		return nil, ErrTransactionFinalized
	}

	if !isValidTransition(currentStatus, newStatus) {
		return nil, fmt.Errorf("%w: %s → %s", ErrInvalidStatusTransition, currentStatus, newStatus)
	}

	// Atomic update + audit log.
	dbTx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer dbTx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(dbTx)

	var failureReason *string
	if reason != nil {
		failureReason = reason
	}

	// SQL-level atomic guard: WHERE status NOT IN ('SUCCESS','FAILED','TIMEOUT','REFUNDED')
	// If another goroutine already moved the transaction to a final state,
	// this returns pgx.ErrNoRows — no data corruption possible.
	updated, err := qtx.UpdateTransactionStatusSafe(ctx, db.UpdateTransactionStatusSafeParams{
		ID:            txID,
		Status:        string(newStatus),
		FailureReason: failureReason,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Another goroutine already finalized this transaction.
			return nil, ErrTransactionFinalized
		}
		return nil, fmt.Errorf("updating status: %w", err)
	}

	// Audit log — record every status change (PRD rule #6).
	auditPayload, _ := json.Marshal(map[string]string{
		"from":   string(currentStatus),
		"to":     string(newStatus),
		"reason": derefString(failureReason),
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TransactionID: &txID,
		MerchantID:    updated.MerchantID,
		EventType:     "STATUS_CHANGED",
		Payload:       auditPayload,
	})
	if err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := dbTx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	// If the transaction reached a terminal state, enqueue webhook dispatch.
	if newStatus.IsFinal() {
		s.enqueueWebhook(txID, updated.MerchantID, newStatus)
	}

	s.logger.Info("transaction status updated",
		zap.String("transaction_id", txID.String()),
		zap.String("from", string(currentStatus)),
		zap.String("to", string(newStatus)),
	)

	return toTransactionModel(updated), nil
}

// =============================================================================
// HandleSMSConfirmation — process SMS received from gateway
// =============================================================================

// HandleSMSConfirmation processes a successful SMS confirmation from the gateway.
// Sets the transaction to SUCCESS, stores the raw SMS, and enqueues webhook dispatch.
func (s *TransactionService) HandleSMSConfirmation(ctx context.Context, txID uuid.UUID, smsRaw string) error {
	// Atomic: confirm + audit log.
	dbTx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer dbTx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(dbTx)

	txn, err := qtx.ConfirmTransaction(ctx, db.ConfirmTransactionParams{
		ID:     txID,
		SmsRaw: smsRaw,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrTransactionNotFound
		}
		return fmt.Errorf("confirming transaction: %w", err)
	}

	// Audit log — SMS_RECEIVED.
	auditPayload, _ := json.Marshal(map[string]interface{}{
		"sms_raw":      smsRaw,
		"confirmed_at": txn.ConfirmedAt,
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TransactionID: &txID,
		MerchantID:    txn.MerchantID,
		EventType:     models.AuditEventSMSReceived,
		Payload:       auditPayload,
	})
	if err != nil {
		return fmt.Errorf("creating audit log: %w", err)
	}

	if err := dbTx.Commit(ctx); err != nil {
		return fmt.Errorf("committing: %w", err)
	}

	// Enqueue webhook dispatch for SUCCESS.
	s.enqueueWebhook(txID, txn.MerchantID, models.StatusSuccess)

	s.logger.Info("transaction confirmed via SMS",
		zap.String("transaction_id", txID.String()),
	)

	return nil
}

// =============================================================================
// Internal helpers
// =============================================================================

// generateInternalRef creates a unique internal reference: KADRYZA-YYYYMMDD-XXXXXXXX
// FIX M3: Uses crypto/rand instead of math/rand for unpredictable references.
func generateInternalRef() string {
	date := time.Now().Format("20060102")
	var buf [4]byte
	crypto_rand.Read(buf[:]) //nolint:errcheck
	suffix := fmt.Sprintf("%08X", binary.BigEndian.Uint32(buf[:]))
	return fmt.Sprintf("KADRYZA-%s-%s", date, suffix)
}

// dispatchToGateway sends a payment instruction to the appropriate gateway via WebSocket.
func (s *TransactionService) dispatchToGateway(ctx context.Context, txn db.Transaction) {
	// TODO: Implement when gateway Hub message routing is built.
	// This will:
	// 1. Find an available gateway for the operator (txn.Operator)
	// 2. Send an INITIATE_PAYMENT message via WebSocket
	// 3. Update the transaction with the gateway_id
	s.logger.Info("dispatching to gateway",
		zap.String("transaction_id", txn.ID.String()),
		zap.String("operator", fmt.Sprint(txn.Operator)),
	)
}

// enqueueWebhook enqueues an Asynq task to dispatch webhooks for a terminal transaction.
func (s *TransactionService) enqueueWebhook(txID, merchantID uuid.UUID, status models.TransactionStatus) {
	payload, _ := json.Marshal(map[string]string{
		"transaction_id": txID.String(),
		"merchant_id":    merchantID.String(),
		"status":         string(status),
	})

	task := asynq.NewTask(workers.TypeWebhookDeliver, payload)
	_, err := s.asynqClient.Enqueue(task,
		asynq.Queue("webhooks"),
		asynq.MaxRetry(4),
		asynq.Retention(24*time.Hour),
	)
	if err != nil {
		// Log but don't fail — the webhook can be retried manually.
		s.logger.Error("failed to enqueue webhook task",
			zap.String("transaction_id", txID.String()),
			zap.Error(err),
		)
	}
}

// isValidTransition defines the allowed state machine transitions.
func isValidTransition(from, to models.TransactionStatus) bool {
	allowed := map[models.TransactionStatus][]models.TransactionStatus{
		models.StatusPending:    {models.StatusProcessing, models.StatusFailed, models.StatusTimeout},
		models.StatusProcessing: {models.StatusWaitingSMS, models.StatusFailed, models.StatusTimeout},
		models.StatusWaitingSMS: {models.StatusSuccess, models.StatusFailed, models.StatusTimeout},
		models.StatusSuccess:    {models.StatusRefunded}, // Only manual refund from SUCCESS
	}

	targets, ok := allowed[from]
	if !ok {
		return false
	}
	for _, t := range targets {
		if t == to {
			return true
		}
	}
	return false
}

// toTransactionModel converts a sqlc-generated row to the business domain model.
func toTransactionModel(t db.Transaction) *models.Transaction {
	return &models.Transaction{
		ID:              t.ID,
		MerchantID:      t.MerchantID,
		Reference:       t.Reference,
		InternalRef:     t.InternalRef,
		Amount:          t.Amount,
		Currency:        models.CurrencyType(fmt.Sprint(t.Currency)),
		Operator:        models.OperatorType(fmt.Sprint(t.Operator)),
		PhoneNumber:     t.PhoneNumber,
		Description:     t.Description,
		Status:          models.TransactionStatus(fmt.Sprint(t.Status)),
		GatewayID:       t.GatewayID,
		USSDSessionID:   t.UssdSessionID,
		SMSRaw:          &t.SmsRaw,
		FailureReason:   t.FailureReason,
		WebhookSent:     t.WebhookSent != nil && *t.WebhookSent,
		WebhookAttempts: int(derefInt32(t.WebhookAttempts)),
		InitiatedAt:     t.InitiatedAt,
		ConfirmedAt:     t.ConfirmedAt,
		ExpiresAt:       t.ExpiresAt,
		CreatedAt:       t.CreatedAt,
		UpdatedAt:       t.UpdatedAt,
	}
}

// derefString safely dereferences a *string, returning "" if nil.
func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// derefInt32 safely dereferences a *int32, returning 0 if nil.
func derefInt32(i *int32) int32 {
	if i == nil {
		return 0
	}
	return *i
}
