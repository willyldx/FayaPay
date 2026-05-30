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

// BillingHandler exposes balance and settlement endpoints (JWT).
type BillingHandler struct {
	service *services.BillingService
	logger  *zap.Logger
}

// NewBillingHandler creates a new BillingHandler.
func NewBillingHandler(service *services.BillingService, logger *zap.Logger) *BillingHandler {
	return &BillingHandler{service: service, logger: logger.Named("billing-handler")}
}

// GetBalance handles GET /v1/balance
func (h *BillingHandler) GetBalance(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	bal, err := h.service.GetBalance(c.Context(), merchantID)
	if err != nil {
		h.logger.Error("get balance failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get balance", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(bal)
}

// CreateSettlement handles POST /v1/settlements
func (h *BillingHandler) CreateSettlement(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	var req models.CreateSettlementRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body", "code": "INVALID_BODY"})
	}
	st, err := h.service.CreateSettlement(c.Context(), merchantID, req)
	if err != nil {
		if errors.Is(err, services.ErrInsufficientBalance) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": "insufficient available balance", "code": "INSUFFICIENT_BALANCE"})
		}
		if isValidationError(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error(), "code": "VALIDATION_ERROR"})
		}
		h.logger.Error("create settlement failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create settlement", "code": "INTERNAL_ERROR"})
	}
	return c.Status(fiber.StatusCreated).JSON(st)
}

// ListSettlements handles GET /v1/settlements
func (h *BillingHandler) ListSettlements(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	resp, err := h.service.ListSettlements(c.Context(), merchantID, int32(c.QueryInt("limit", 20)), int32(c.QueryInt("offset", 0)))
	if err != nil {
		h.logger.Error("list settlements failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list settlements", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(resp)
}

// GetSettlement handles GET /v1/settlements/:id
func (h *BillingHandler) GetSettlement(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	st, err := h.service.GetSettlement(c.Context(), merchantID, id)
	if err != nil {
		if errors.Is(err, services.ErrSettlementNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "settlement not found", "code": "NOT_FOUND"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(st)
}

// CancelSettlement handles POST /v1/settlements/:id/cancel
func (h *BillingHandler) CancelSettlement(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	st, err := h.service.CancelSettlement(c.Context(), merchantID, id)
	if err != nil {
		if errors.Is(err, services.ErrSettlementNotCancellable) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "settlement not found or not in a cancellable state", "code": "NOT_CANCELLABLE"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(st)
}
