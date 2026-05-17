package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fayapay/faya-backend/internal/api/middleware"
	"github.com/fayapay/faya-backend/internal/models"
	"github.com/fayapay/faya-backend/internal/services"
)

// WebhookHandler handles webhook endpoint CRUD and testing.
type WebhookHandler struct {
	service *services.WebhookService
	logger  *zap.Logger
}

// NewWebhookHandler creates a new WebhookHandler.
func NewWebhookHandler(service *services.WebhookService, logger *zap.Logger) *WebhookHandler {
	return &WebhookHandler{
		service: service,
		logger:  logger.Named("webhook-handler"),
	}
}

// Create handles POST /v1/webhooks
func (h *WebhookHandler) Create(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	var req models.CreateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "url is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	resp, err := h.service.Create(c.Context(), merchantID, req)
	if err != nil {
		h.logger.Error("create webhook failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create webhook endpoint",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// List handles GET /v1/webhooks
func (h *WebhookHandler) List(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	endpoints, err := h.service.ListByMerchant(c.Context(), merchantID)
	if err != nil {
		h.logger.Error("list webhooks failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list webhook endpoints",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(fiber.Map{
		"endpoints": endpoints,
	})
}

// Delete handles DELETE /v1/webhooks/:id
func (h *WebhookHandler) Delete(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	endpointID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid endpoint ID",
			"code":  "INVALID_ID",
		})
	}

	if err := h.service.Delete(c.Context(), merchantID, endpointID); err != nil {
		h.logger.Error("delete webhook failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete webhook endpoint",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// Test handles POST /v1/webhooks/:id/test
func (h *WebhookHandler) Test(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	endpointID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid endpoint ID",
			"code":  "INVALID_ID",
		})
	}

	if err := h.service.TestEndpoint(c.Context(), merchantID, endpointID); err != nil {
		if errors.Is(err, services.ErrWebhookEndpointNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "webhook endpoint not found",
				"code":  "NOT_FOUND",
			})
		}
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "test webhook delivery failed: " + err.Error(),
			"code":  "WEBHOOK_TEST_FAILED",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "ok",
		"message": "test webhook delivered successfully",
	})
}
