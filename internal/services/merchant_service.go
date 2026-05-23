package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/kadryza/kadryza-backend/internal/config"
	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/models"
	"github.com/kadryza/kadryza-backend/pkg/crypto"
)

// =============================================================================
// Errors
// =============================================================================

var (
	ErrMerchantNotFound  = errors.New("merchant not found")
	ErrEmailAlreadyTaken = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrMerchantInactive  = errors.New("merchant account is deactivated")
)

// =============================================================================
// Service
// =============================================================================

// MerchantService handles merchant registration, authentication, and API key management.
type MerchantService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	config  *config.Config
	logger  *zap.Logger
}

// NewMerchantService creates a new MerchantService.
func NewMerchantService(pool *pgxpool.Pool, cfg *config.Config, logger *zap.Logger) *MerchantService {
	return &MerchantService{
		pool:    pool,
		queries: db.New(pool),
		config:  cfg,
		logger:  logger.Named("merchant-svc"),
	}
}

// =============================================================================
// Register
// =============================================================================

// Register creates a new merchant account.
// Returns the public merchant profile (no sensitive fields).
func (s *MerchantService) Register(ctx context.Context, req models.CreateMerchantRequest) (*models.MerchantPublic, error) {
	// Hash password with bcrypt (cost 12 — good balance of security vs speed).
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	// Start a transaction — merchant creation + audit log must be atomic.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	// Create the merchant.
	merchant, err := qtx.CreateMerchant(ctx, db.CreateMerchantParams{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
	})
	if err != nil {
		// Check for unique constraint violation on email.
		if isUniqueViolation(err) {
			return nil, ErrEmailAlreadyTaken
		}
		return nil, fmt.Errorf("creating merchant: %w", err)
	}

	// Audit log.
	auditPayload, _ := json.Marshal(map[string]string{
		"name":  req.Name,
		"email": req.Email,
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchant.ID,
		EventType:  models.AuditEventMerchantCreated,
		Payload:    auditPayload,
	})
	if err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("merchant registered",
		zap.String("merchant_id", merchant.ID.String()),
		zap.String("email", merchant.Email),
	)

	result := toMerchantPublic(merchant)
	return &result, nil
}

// =============================================================================
// Login
// =============================================================================

// Login authenticates a merchant by email and password, returning a JWT token.
func (s *MerchantService) Login(ctx context.Context, req models.LoginRequest) (*models.LoginResponse, error) {
	// Look up merchant by email.
	merchant, err := s.queries.GetMerchantByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}

	// Check if account is active.
	if merchant.IsActive != nil && !*merchant.IsActive {
		return nil, ErrMerchantInactive
	}

	// Verify password.
	if err := bcrypt.CompareHashAndPassword([]byte(merchant.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Generate JWT.
	expiresAt := time.Now().Add(s.config.JWTExpiry)
	token, err := s.generateJWT(merchant.ID, merchant.Email, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("generating JWT: %w", err)
	}

	s.logger.Info("merchant logged in",
		zap.String("merchant_id", merchant.ID.String()),
	)

	pub := toMerchantPublic(merchant)
	return &models.LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		Merchant:  pub,
	}, nil
}

// =============================================================================
// API Key management
// =============================================================================

// GenerateAPIKey creates a new API key for the merchant.
// The raw key is returned ONCE in the response — it cannot be retrieved again.
// Only the SHA-256 hash is stored in the database.
func (s *MerchantService) GenerateAPIKey(ctx context.Context, merchantID uuid.UUID) (*models.APIKeyResponse, error) {
	// Generate a cryptographically random API key.
	rawKey, prefix, err := crypto.GenerateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("generating API key: %w", err)
	}

	// Hash for storage — raw key is never persisted.
	keyHash := crypto.HashAPIKey(rawKey)

	// Store hash + prefix in DB (within a transaction with audit log).
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	_, err = qtx.UpdateMerchantAPIKey(ctx, db.UpdateMerchantAPIKeyParams{
		ID:           merchantID,
		ApiKeyHash:   &keyHash,
		ApiKeyPrefix: &prefix,
	})
	if err != nil {
		return nil, fmt.Errorf("storing API key hash: %w", err)
	}

	// Audit log.
	auditPayload, _ := json.Marshal(map[string]string{
		"prefix": prefix,
		"action": "API_KEY_GENERATED",
	})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventAPIKeyGenerated,
		Payload:    auditPayload,
	})
	if err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("API key generated",
		zap.String("merchant_id", merchantID.String()),
		zap.String("prefix", prefix),
	)

	return &models.APIKeyResponse{
		APIKey:    rawKey, // Shown ONCE — never again.
		Prefix:    prefix,
		CreatedAt: time.Now(),
	}, nil
}

// RevokeAPIKey removes the merchant's API key, invalidating it immediately.
func (s *MerchantService) RevokeAPIKey(ctx context.Context, merchantID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	if err := qtx.RevokeAPIKey(ctx, merchantID); err != nil {
		return fmt.Errorf("revoking API key: %w", err)
	}

	auditPayload, _ := json.Marshal(map[string]string{"action": "API_KEY_REVOKED"})
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventAPIKeyRevoked,
		Payload:    auditPayload,
	})
	if err != nil {
		return fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("API key revoked", zap.String("merchant_id", merchantID.String()))
	return nil
}

// GetByID retrieves a merchant by ID.
func (s *MerchantService) GetByID(ctx context.Context, merchantID uuid.UUID) (*models.MerchantPublic, error) {
	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("querying merchant: %w", err)
	}
	result := toMerchantPublic(merchant)
	return &result, nil
}

// AuthenticateByAPIKey validates a raw API key and returns the merchant.
// Used by the API key middleware for transaction endpoints.
func (s *MerchantService) AuthenticateByAPIKey(ctx context.Context, rawKey string) (*db.Merchant, error) {
	keyHash := crypto.HashAPIKey(rawKey)

	merchant, err := s.queries.GetMerchantByAPIKeyHash(ctx, &keyHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("querying merchant by API key: %w", err)
	}

	if merchant.IsActive != nil && !*merchant.IsActive {
		return nil, ErrMerchantInactive
	}

	return &merchant, nil
}

// =============================================================================
// JWT helpers
// =============================================================================

// JWTClaims are the custom claims embedded in merchant JWTs.
type JWTClaims struct {
	MerchantID string `json:"merchant_id"`
	Email      string `json:"email"`
	jwt.RegisteredClaims
}

// generateJWT creates a signed JWT token for the given merchant.
func (s *MerchantService) generateJWT(merchantID uuid.UUID, email string, expiresAt time.Time) (string, error) {
	claims := JWTClaims{
		MerchantID: merchantID.String(),
		Email:      email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "kadryza",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

// =============================================================================
// Helpers
// =============================================================================

// toMerchantPublic converts a sqlc-generated Merchant row to the safe public model.
func toMerchantPublic(m db.Merchant) models.MerchantPublic {
	return models.MerchantPublic{
		ID:           m.ID,
		Name:         m.Name,
		Email:        m.Email,
		APIKeyPrefix: m.ApiKeyPrefix,
		IsActive:     m.IsActive != nil && *m.IsActive,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}

// isUniqueViolation checks if a pgx error is a PostgreSQL unique constraint violation (code 23505).
func isUniqueViolation(err error) bool {
	// pgx wraps PostgreSQL errors — check the SQLSTATE code.
	var pgErr interface{ SQLState() string }
	if errors.As(err, &pgErr) {
		return pgErr.SQLState() == "23505"
	}
	return false
}
