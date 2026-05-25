package models

import (
	"time"

	"github.com/google/uuid"
)

// Merchant represents a registered business using Kadryza.
type Merchant struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	PasswordHash  string    `json:"-"` // Never serialized to JSON
	APIKeyHash    *string   `json:"-"` // Never serialized — hash only
	APIKeyPrefix  *string   `json:"api_key_prefix,omitempty"`
	IsActive      bool      `json:"is_active"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// MerchantPublic is the safe representation of a Merchant for API responses.
// Excludes all sensitive fields (password hash, API key hash).
type MerchantPublic struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	APIKeyPrefix  *string   `json:"api_key_prefix,omitempty"`
	IsActive      bool      `json:"is_active"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ToPublic converts a Merchant to its safe API representation.
func (m *Merchant) ToPublic() MerchantPublic {
	return MerchantPublic{
		ID:            m.ID,
		Name:          m.Name,
		Email:         m.Email,
		APIKeyPrefix:  m.APIKeyPrefix,
		IsActive:      m.IsActive,
		EmailVerified: m.EmailVerified,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

// CreateMerchantRequest is the payload for merchant registration.
type CreateMerchantRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=255"`
	Email    string `json:"email" validate:"required,email,max=255"`
	Password string `json:"password" validate:"required,min=8"`
}

// LoginRequest is the payload for merchant authentication.
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// LoginResponse is returned after successful authentication.
type LoginResponse struct {
	Token     string         `json:"token"`
	ExpiresAt time.Time      `json:"expires_at"`
	Merchant  MerchantPublic `json:"merchant"`
}

// APIKeyResponse is returned once when a new API key is generated.
// The raw key is NEVER retrievable again after this response.
type APIKeyResponse struct {
	APIKey    string `json:"api_key"`    // Full key — shown only once
	Prefix   string `json:"prefix"`     // e.g. "kadryza_live_"
	CreatedAt time.Time `json:"created_at"`
}

// ResendVerificationRequest is the payload for requesting a new verification email.
type ResendVerificationRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ForgotPasswordRequest is the payload for requesting a password reset email.
type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ResetPasswordRequest is the payload for resetting a password with a token.
type ResetPasswordRequest struct {
	Password string `json:"password" validate:"required,min=8"`
}
