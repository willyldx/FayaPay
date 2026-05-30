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

// PaymentLinkHandler handles payment-link management (JWT) and the public
// hosted checkout (no auth).
type PaymentLinkHandler struct {
	service   *services.PaymentLinkService
	txService *services.TransactionService
	logger    *zap.Logger
}

// NewPaymentLinkHandler creates a new PaymentLinkHandler.
func NewPaymentLinkHandler(service *services.PaymentLinkService, txService *services.TransactionService, logger *zap.Logger) *PaymentLinkHandler {
	return &PaymentLinkHandler{
		service:   service,
		txService: txService,
		logger:    logger.Named("payment-link-handler"),
	}
}

// =============================================================================
// Dashboard (JWT) handlers
// =============================================================================

// Create handles POST /v1/payment-links
func (h *PaymentLinkHandler) Create(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}

	var req models.CreatePaymentLinkRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body", "code": "INVALID_BODY"})
	}

	link, err := h.service.Create(c.Context(), merchantID, req)
	if err != nil {
		if isValidationError(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error(), "code": "VALIDATION_ERROR"})
		}
		h.logger.Error("create payment link failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create payment link", "code": "INTERNAL_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(link)
}

// List handles GET /v1/payment-links
func (h *PaymentLinkHandler) List(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}

	resp, err := h.service.List(c.Context(), merchantID, int32(c.QueryInt("limit", 20)), int32(c.QueryInt("offset", 0)))
	if err != nil {
		h.logger.Error("list payment links failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list payment links", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(resp)
}

// Get handles GET /v1/payment-links/:id
func (h *PaymentLinkHandler) Get(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	link, err := h.service.GetByID(c.Context(), merchantID, id)
	if err != nil {
		if errors.Is(err, services.ErrPaymentLinkNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "payment link not found", "code": "NOT_FOUND"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(link)
}

// SetActive handles PATCH /v1/payment-links/:id  (body: {"is_active": bool})
func (h *PaymentLinkHandler) SetActive(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	var body struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body", "code": "INVALID_BODY"})
	}
	link, err := h.service.SetActive(c.Context(), merchantID, id, body.IsActive)
	if err != nil {
		if errors.Is(err, services.ErrPaymentLinkNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "payment link not found", "code": "NOT_FOUND"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(link)
}

// Delete handles DELETE /v1/payment-links/:id
func (h *PaymentLinkHandler) Delete(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return authRequired(c)
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	if err := h.service.Delete(c.Context(), merchantID, id); err != nil {
		if errors.Is(err, services.ErrPaymentLinkNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "payment link not found", "code": "NOT_FOUND"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// =============================================================================
// Public hosted-checkout handlers (no auth)
// =============================================================================

// GetCheckout handles GET /v1/checkout/:slug
func (h *PaymentLinkHandler) GetCheckout(c *fiber.Ctx) error {
	view, err := h.service.GetCheckoutView(c.Context(), c.Params("slug"))
	if err != nil {
		if errors.Is(err, services.ErrPaymentLinkNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "payment link not found", "code": "NOT_FOUND"})
		}
		h.logger.Error("get checkout failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(view)
}

// Pay handles POST /v1/checkout/:slug/pay — initiates a mobile-money payment.
func (h *PaymentLinkHandler) Pay(c *fiber.Ctx) error {
	slug := c.Params("slug")

	var req models.CheckoutPayRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body", "code": "INVALID_BODY"})
	}
	if strings.TrimSpace(req.PhoneNumber) == "" || strings.TrimSpace(req.Operator) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone_number and operator are required", "code": "VALIDATION_ERROR"})
	}

	link, err := h.service.GetPayableLink(c.Context(), slug)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrPaymentLinkNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "payment link not found", "code": "NOT_FOUND"})
		case errors.Is(err, services.ErrPaymentLinkInactive):
			return c.Status(fiber.StatusGone).JSON(fiber.Map{"error": "this payment link is no longer active", "code": "LINK_INACTIVE"})
		case errors.Is(err, services.ErrPaymentLinkExpired):
			return c.Status(fiber.StatusGone).JSON(fiber.Map{"error": "this payment link has expired", "code": "LINK_EXPIRED"})
		default:
			h.logger.Error("get payable link failed", zap.Error(err))
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
		}
	}

	txReq := models.CreateTransactionRequest{
		Reference:     "chk_" + uuid.New().String(),
		Amount:        link.Amount,
		Currency:      models.CurrencyType(link.Currency),
		Operator:      models.OperatorType(strings.ToUpper(strings.TrimSpace(req.Operator))),
		PhoneNumber:   strings.TrimSpace(req.PhoneNumber),
		PaymentLinkID: &link.ID,
	}
	if link.Description != nil {
		txReq.Description = *link.Description
	}

	resp, err := h.txService.Initiate(c.Context(), link.MerchantID, txReq)
	if err != nil {
		if isValidationError(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error(), "code": "VALIDATION_ERROR"})
		}
		h.logger.Error("checkout payment failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to initiate payment", "code": "INTERNAL_ERROR"})
	}

	// Best-effort usage counter — never fail the payment on this.
	if rerr := h.service.RecordPayment(c.Context(), link.ID); rerr != nil {
		h.logger.Warn("failed to record payment count", zap.Error(rerr))
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// CheckoutStatus handles GET /v1/checkout/tx/:id — public polling of a payment.
func (h *PaymentLinkHandler) CheckoutStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id", "code": "INVALID_ID"})
	}
	status, err := h.service.GetTransactionStatus(c.Context(), id)
	if err != nil {
		if errors.Is(err, services.ErrPaymentLinkNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "transaction not found", "code": "NOT_FOUND"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error", "code": "INTERNAL_ERROR"})
	}
	return c.JSON(status)
}

// authRequired is a small shared helper for the JWT handlers.
func authRequired(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required", "code": "AUTH_REQUIRED"})
}
