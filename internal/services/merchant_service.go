package services

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/hex"
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
	ErrMerchantNotFound    = errors.New("merchant not found")
	ErrEmailAlreadyTaken   = errors.New("email already registered")
	ErrInvalidCredentials  = errors.New("invalid email or password")
	ErrMerchantInactive    = errors.New("merchant account is deactivated")
	ErrEmailNotVerified    = errors.New("email not verified")
	ErrInvalidToken        = errors.New("invalid or expired token")
	ErrEmailAlreadyVerified = errors.New("email already verified")
	ErrInvalidCurrentPassword = errors.New("current password is incorrect")
)

// =============================================================================
// Service
// =============================================================================

// MerchantService handles merchant registration, authentication, and API key management.
type MerchantService struct {
	pool     *pgxpool.Pool
	queries  *db.Queries
	config   *config.Config
	logger   *zap.Logger
	emailSvc *EmailService
}

// NewMerchantService creates a new MerchantService.
func NewMerchantService(pool *pgxpool.Pool, cfg *config.Config, logger *zap.Logger, emailSvc *EmailService) *MerchantService {
	return &MerchantService{
		pool:     pool,
		queries:  db.New(pool),
		config:   cfg,
		logger:   logger.Named("merchant-svc"),
		emailSvc: emailSvc,
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

	// Generate verification token and send email (outside DB tx — non-critical).
	verificationToken, err := generateSecureToken()
	if err != nil {
		s.logger.Error("failed to generate verification token", zap.Error(err))
	} else {
		expiresAt := time.Now().Add(24 * time.Hour)
		if err := s.queries.SetVerificationToken(ctx, db.SetVerificationTokenParams{
			ID:                        merchant.ID,
			VerificationToken:         &verificationToken,
			VerificationTokenExpiresAt: expiresAt,
		}); err != nil {
			s.logger.Error("failed to store verification token", zap.Error(err))
		} else if s.emailSvc != nil {
			go func() {
				if err := s.emailSvc.SendVerificationEmail(req.Email, verificationToken, req.Name); err != nil {
					s.logger.Error("failed to send verification email",
						zap.String("email", req.Email),
						zap.Error(err),
					)
				}
			}()
		}
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

// UpdateProfile updates the merchant's name. Email is intentionally immutable here.
func (s *MerchantService) UpdateProfile(ctx context.Context, merchantID uuid.UUID, name string) (*models.MerchantPublic, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	merchant, err := qtx.UpdateMerchantName(ctx, db.UpdateMerchantNameParams{
		ID:   merchantID,
		Name: name,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMerchantNotFound
		}
		return nil, fmt.Errorf("updating merchant name: %w", err)
	}

	auditPayload, _ := json.Marshal(map[string]string{
		"name":   name,
		"action": "PROFILE_UPDATED",
	})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventMerchantUpdated,
		Payload:    auditPayload,
	}); err != nil {
		return nil, fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("merchant profile updated", zap.String("merchant_id", merchantID.String()))
	result := toMerchantPublic(merchant)
	return &result, nil
}

// ChangePassword verifies the current password (bcrypt) and stores a new hash.
func (s *MerchantService) ChangePassword(ctx context.Context, merchantID uuid.UUID, currentPassword, newPassword string) error {
	merchant, err := s.queries.GetMerchantByID(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrMerchantNotFound
		}
		return fmt.Errorf("querying merchant: %w", err)
	}

	// Verify the current password before allowing a change.
	if err := bcrypt.CompareHashAndPassword([]byte(merchant.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrInvalidCurrentPassword
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("hashing new password: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	if err := qtx.UpdatePassword(ctx, db.UpdatePasswordParams{
		ID:           merchantID,
		PasswordHash: string(newHash),
	}); err != nil {
		return fmt.Errorf("updating password: %w", err)
	}

	auditPayload, _ := json.Marshal(map[string]string{"action": "PASSWORD_CHANGED"})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		MerchantID: merchantID,
		EventType:  models.AuditEventPasswordChanged,
		Payload:    auditPayload,
	}); err != nil {
		return fmt.Errorf("creating audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	s.logger.Info("merchant password changed", zap.String("merchant_id", merchantID.String()))
	return nil
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
	emailVerified := false
	if m.EmailVerified != nil {
		emailVerified = *m.EmailVerified
	}
	return models.MerchantPublic{
		ID:            m.ID,
		Name:          m.Name,
		Email:         m.Email,
		APIKeyPrefix:  m.ApiKeyPrefix,
		IsActive:      m.IsActive != nil && *m.IsActive,
		EmailVerified: emailVerified,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
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

// generateSecureToken creates a cryptographically random 32-byte hex token.
func generateSecureToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := cryptorand.Read(buf); err != nil {
		return "", fmt.Errorf("crypto/rand: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// =============================================================================
// Email Verification
// =============================================================================

// VerifyEmail validates a verification token and marks the merchant's email as verified.
func (s *MerchantService) VerifyEmail(ctx context.Context, token string) error {
	if token == "" {
		return ErrInvalidToken
	}

	merchant, err := s.queries.GetMerchantByVerificationToken(ctx, &token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return fmt.Errorf("querying verification token: %w", err)
	}

	if err := s.queries.VerifyEmail(ctx, merchant.ID); err != nil {
		return fmt.Errorf("verifying email: %w", err)
	}

	s.logger.Info("email verified",
		zap.String("merchant_id", merchant.ID.String()),
		zap.String("email", merchant.Email),
	)

	return nil
}

// ResendVerification generates a new verification token and sends a new email.
func (s *MerchantService) ResendVerification(ctx context.Context, email string) error {
	merchant, err := s.queries.GetMerchantByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Don't reveal whether the email exists.
			return nil
		}
		return fmt.Errorf("querying merchant: %w", err)
	}

	// Already verified.
	if merchant.EmailVerified != nil && *merchant.EmailVerified {
		return ErrEmailAlreadyVerified
	}

	token, err := generateSecureToken()
	if err != nil {
		return fmt.Errorf("generating token: %w", err)
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	if err := s.queries.SetVerificationToken(ctx, db.SetVerificationTokenParams{
		ID:                        merchant.ID,
		VerificationToken:         &token,
		VerificationTokenExpiresAt: expiresAt,
	}); err != nil {
		return fmt.Errorf("storing verification token: %w", err)
	}

	if s.emailSvc != nil {
		if err := s.emailSvc.SendVerificationEmail(email, token, merchant.Name); err != nil {
			s.logger.Error("failed to send verification email", zap.Error(err))
			return fmt.Errorf("sending email: %w", err)
		}
	}

	return nil
}

// =============================================================================
// Password Reset
// =============================================================================

// ForgotPassword generates a reset token and sends a password reset email.
func (s *MerchantService) ForgotPassword(ctx context.Context, email string) error {
	merchant, err := s.queries.GetMerchantByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Don't reveal whether the email exists.
			return nil
		}
		return fmt.Errorf("querying merchant: %w", err)
	}

	token, err := generateSecureToken()
	if err != nil {
		return fmt.Errorf("generating token: %w", err)
	}

	expiresAt := time.Now().Add(1 * time.Hour)
	if err := s.queries.SetResetPasswordToken(ctx, db.SetResetPasswordTokenParams{
		ID:                    merchant.ID,
		ResetPasswordToken:    &token,
		ResetPasswordExpiresAt: expiresAt,
	}); err != nil {
		return fmt.Errorf("storing reset token: %w", err)
	}

	if s.emailSvc != nil {
		if err := s.emailSvc.SendPasswordResetEmail(email, token, merchant.Name); err != nil {
			s.logger.Error("failed to send password reset email", zap.Error(err))
			return fmt.Errorf("sending email: %w", err)
		}
	}

	s.logger.Info("password reset email sent",
		zap.String("merchant_id", merchant.ID.String()),
	)

	return nil
}

// ResetPassword validates a reset token and updates the merchant's password.
func (s *MerchantService) ResetPassword(ctx context.Context, token, newPassword string) error {
	if token == "" {
		return ErrInvalidToken
	}

	merchant, err := s.queries.GetMerchantByResetToken(ctx, &token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return fmt.Errorf("querying reset token: %w", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	if err := s.queries.UpdatePassword(ctx, db.UpdatePasswordParams{
		ID:           merchant.ID,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		return fmt.Errorf("updating password: %w", err)
	}

	s.logger.Info("password reset successful",
		zap.String("merchant_id", merchant.ID.String()),
	)

	return nil
}

// IsEmailVerified checks if a merchant's email is verified.
func (s *MerchantService) IsEmailVerified(ctx context.Context, merchantID uuid.UUID) (bool, error) {
	verified, err := s.queries.IsEmailVerified(ctx, merchantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, ErrMerchantNotFound
		}
		return false, fmt.Errorf("checking email verification: %w", err)
	}
	if verified == nil {
		return false, nil
	}
	return *verified, nil
}
