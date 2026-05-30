package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/kadryza/kadryza-backend/internal/api/middleware"
	"github.com/kadryza/kadryza-backend/internal/models"
	"github.com/kadryza/kadryza-backend/internal/services"
)

// MerchantHandler handles merchant authentication and API key management.
type MerchantHandler struct {
	service *services.MerchantService
	logger  *zap.Logger
}

// NewMerchantHandler creates a new MerchantHandler.
func NewMerchantHandler(service *services.MerchantService, logger *zap.Logger) *MerchantHandler {
	return &MerchantHandler{
		service: service,
		logger:  logger.Named("merchant-handler"),
	}
}

// Register handles POST /v1/auth/register
func (h *MerchantHandler) Register(c *fiber.Ctx) error {
	var req models.CreateMerchantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	// Basic validation.
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name, email, and password are required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if len(req.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must be at least 8 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	// FIX M4: bcrypt silently truncates at 72 bytes — two passwords
	// sharing the same first 72 bytes would produce identical hashes.
	if len(req.Password) > 72 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must not exceed 72 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	merchant, err := h.service.Register(c.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrEmailAlreadyTaken) {
			// FIX L3: Generic message to prevent email enumeration.
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "registration failed — check your details and try again",
				"code":  "REGISTRATION_CONFLICT",
			})
		}
		h.logger.Error("register failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "registration failed",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(merchant)
}

// Login handles POST /v1/auth/login
func (h *MerchantHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email and password are required",
			"code":  "VALIDATION_ERROR",
		})
	}

	resp, err := h.service.Login(c.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid email or password",
				"code":  "INVALID_CREDENTIALS",
			})
		}
		if errors.Is(err, services.ErrMerchantInactive) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "account is deactivated",
				"code":  "ACCOUNT_INACTIVE",
			})
		}
		h.logger.Error("login failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "login failed",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(resp)
}

// GenerateAPIKey handles POST /v1/auth/api-keys
func (h *MerchantHandler) GenerateAPIKey(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	resp, err := h.service.GenerateAPIKey(c.Context(), merchantID)
	if err != nil {
		h.logger.Error("generate API key failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate API key",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GenerateTestAPIKey handles POST /v1/auth/api-keys/test
func (h *MerchantHandler) GenerateTestAPIKey(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required", "code": "AUTH_REQUIRED"})
	}

	resp, err := h.service.GenerateTestAPIKey(c.Context(), merchantID)
	if err != nil {
		h.logger.Error("generate test API key failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate test API key", "code": "INTERNAL_ERROR"})
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListAPIKeys handles GET /v1/auth/api-keys
func (h *MerchantHandler) ListAPIKeys(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	merchant, err := h.service.GetByID(c.Context(), merchantID)
	if err != nil {
		h.logger.Error("failed to get merchant for api keys", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal error",
			"code":  "INTERNAL_ERROR",
		})
	}

	keys := make([]map[string]interface{}, 0, 2)
	if merchant.APIKeyPrefix != nil {
		keys = append(keys, map[string]interface{}{
			"id":         merchant.ID.String(),
			"prefix":     *merchant.APIKeyPrefix,
			"is_test":    false,
			"created_at": merchant.UpdatedAt,
		})
	}
	if merchant.TestAPIKeyPrefix != nil {
		keys = append(keys, map[string]interface{}{
			"id":         merchant.ID.String() + "-test",
			"prefix":     *merchant.TestAPIKeyPrefix,
			"is_test":    true,
			"created_at": merchant.UpdatedAt,
		})
	}

	return c.JSON(keys)
}

// RevokeAPIKey handles DELETE /v1/auth/api-keys/:id
func (h *MerchantHandler) RevokeAPIKey(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	// The :id param is the merchant's own ID for now (single key per merchant).
	// If multiple keys are needed later, this would be the key ID.
	_ = c.Params("id")

	if err := h.service.RevokeAPIKey(c.Context(), merchantID); err != nil {
		h.logger.Error("revoke API key failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to revoke API key",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// GetProfile handles GET /v1/auth/me
func (h *MerchantHandler) GetProfile(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	merchant, err := h.service.GetByID(c.Context(), merchantID)
	if err != nil {
		if errors.Is(err, services.ErrMerchantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "merchant not found",
				"code":  "NOT_FOUND",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal error",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(merchant)
}

// UpdateProfile handles PATCH /v1/merchants/profile
func (h *MerchantHandler) UpdateProfile(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	var req models.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name is required",
			"code":  "VALIDATION_ERROR",
		})
	}
	if len(req.Name) > 255 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name must not exceed 255 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	merchant, err := h.service.UpdateProfile(c.Context(), merchantID, req.Name)
	if err != nil {
		if errors.Is(err, services.ErrMerchantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "merchant not found",
				"code":  "NOT_FOUND",
			})
		}
		h.logger.Error("update profile failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update profile",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(merchant)
}

// ChangePassword handles PATCH /v1/auth/change-password
func (h *MerchantHandler) ChangePassword(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	var req models.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "current_password and new_password are required",
			"code":  "VALIDATION_ERROR",
		})
	}
	if len(req.NewPassword) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new password must be at least 8 characters",
			"code":  "VALIDATION_ERROR",
		})
	}
	// bcrypt silently truncates beyond 72 bytes — reject longer passwords.
	if len(req.NewPassword) > 72 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new password must not exceed 72 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.ChangePassword(c.Context(), merchantID, req.CurrentPassword, req.NewPassword); err != nil {
		if errors.Is(err, services.ErrInvalidCurrentPassword) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "current password is incorrect",
				"code":  "INVALID_CREDENTIALS",
			})
		}
		if errors.Is(err, services.ErrMerchantNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "merchant not found",
				"code":  "NOT_FOUND",
			})
		}
		h.logger.Error("change password failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to change password",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(fiber.Map{"message": "password updated successfully"})
}

// parseMerchantID is a helper that parses and returns a UUID from locals.
func parseMerchantID(c *fiber.Ctx) (uuid.UUID, error) {
	id, ok := middleware.GetMerchantID(c)
	if !ok {
		return uuid.Nil, errors.New("merchant_id not found in context")
	}
	return id, nil
}

// VerifyEmail handles GET /v1/auth/verify/:token
func (h *MerchantHandler) VerifyEmail(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "token is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.VerifyEmail(c.Context(), token); err != nil {
		if errors.Is(err, services.ErrInvalidToken) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid or expired verification token",
				"code":  "INVALID_TOKEN",
			})
		}
		h.logger.Error("verify email failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "verification failed",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Email vérifié avec succès",
		"code":    "EMAIL_VERIFIED",
	})
}

// ResendVerification handles POST /v1/auth/resend-verification
func (h *MerchantHandler) ResendVerification(c *fiber.Ctx) error {
	var req models.ResendVerificationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.ResendVerification(c.Context(), req.Email); err != nil {
		if errors.Is(err, services.ErrEmailAlreadyVerified) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "email is already verified",
				"code":  "ALREADY_VERIFIED",
			})
		}
		h.logger.Error("resend verification failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to resend verification",
			"code":  "INTERNAL_ERROR",
		})
	}

	// Always return success to prevent email enumeration.
	return c.JSON(fiber.Map{
		"message": "Si cette adresse existe, un email de vérification a été envoyé",
		"code":    "VERIFICATION_SENT",
	})
}

// ForgotPassword handles POST /v1/auth/forgot-password
func (h *MerchantHandler) ForgotPassword(c *fiber.Ctx) error {
	var req models.ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.ForgotPassword(c.Context(), req.Email); err != nil {
		h.logger.Error("forgot password failed", zap.Error(err))
		// Don't return error details — always success to prevent enumeration.
	}

	return c.JSON(fiber.Map{
		"message": "Si cette adresse existe, un email de réinitialisation a été envoyé",
		"code":    "RESET_EMAIL_SENT",
	})
}

// ResetPassword handles POST /v1/auth/reset-password/:token
func (h *MerchantHandler) ResetPassword(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "token is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	var req models.ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.Password == "" || len(req.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must be at least 8 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	if len(req.Password) > 72 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must not exceed 72 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.ResetPassword(c.Context(), token, req.Password); err != nil {
		if errors.Is(err, services.ErrInvalidToken) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid or expired reset token",
				"code":  "INVALID_TOKEN",
			})
		}
		h.logger.Error("reset password failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "password reset failed",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Mot de passe réinitialisé avec succès",
		"code":    "PASSWORD_RESET",
	})
}
