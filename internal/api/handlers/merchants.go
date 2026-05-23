package handlers

import (
	"errors"

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

	var keys []map[string]interface{}
	if merchant.APIKeyPrefix != nil {
		keys = append(keys, map[string]interface{}{
			"id":         merchant.ID.String(),
			"prefix":     *merchant.APIKeyPrefix,
			"created_at": merchant.UpdatedAt,
		})
	} else {
		keys = make([]map[string]interface{}, 0)
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

// parseMerchantID is a helper that parses and returns a UUID from locals.
func parseMerchantID(c *fiber.Ctx) (uuid.UUID, error) {
	id, ok := middleware.GetMerchantID(c)
	if !ok {
		return uuid.Nil, errors.New("merchant_id not found in context")
	}
	return id, nil
}
