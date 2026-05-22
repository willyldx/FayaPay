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

// TransactionHandler handles transaction-related API requests.
type TransactionHandler struct {
	service *services.TransactionService
	logger  *zap.Logger
}

// NewTransactionHandler creates a new TransactionHandler.
func NewTransactionHandler(service *services.TransactionService, logger *zap.Logger) *TransactionHandler {
	return &TransactionHandler{
		service: service,
		logger:  logger.Named("transaction-handler"),
	}
}

// Initiate handles POST /v1/transactions
func (h *TransactionHandler) Initiate(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	var req models.CreateTransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	resp, err := h.service.Initiate(c.Context(), merchantID, req)
	if err != nil {
		if errors.Is(err, services.ErrDuplicateReference) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "transaction with this reference already exists",
				"code":  "DUPLICATE_REFERENCE",
			})
		}
		// Validation errors from req.Validate().
		if isValidationError(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
				"code":  "VALIDATION_ERROR",
			})
		}

		h.logger.Error("initiate transaction failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to initiate transaction",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetByID handles GET /v1/transactions/:id
func (h *TransactionHandler) GetByID(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	txID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid transaction ID",
			"code":  "INVALID_ID",
		})
	}

	txn, err := h.service.GetByID(c.Context(), merchantID, txID)
	if err != nil {
		if errors.Is(err, services.ErrTransactionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "transaction not found",
				"code":  "NOT_FOUND",
			})
		}
		h.logger.Error("get transaction failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to retrieve transaction",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(txn)
}

// List handles GET /v1/transactions
func (h *TransactionHandler) List(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
			"code":  "AUTH_REQUIRED",
		})
	}

	req := models.TransactionListRequest{
		MerchantID: merchantID,
		Limit:      int32(c.QueryInt("limit", 20)),
		Offset:     int32(c.QueryInt("offset", 0)),
	}

	// Optional status filter.
	if statusStr := c.Query("status"); statusStr != "" {
		status := models.TransactionStatus(statusStr)
		if !status.IsValid() {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid status filter",
				"code":  "INVALID_STATUS",
			})
		}
		req.Status = &status
	}

	resp, err := h.service.List(c.Context(), req)
	if err != nil {
		h.logger.Error("list transactions failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list transactions",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(resp)
}

// isValidationError checks if an error wraps a validation message.
func isValidationError(err error) bool {
	// Validation errors from CreateTransactionRequest.Validate() are formatted
	// as "validation: <message>". Check the prefix.
	return err != nil && len(err.Error()) > 12 && err.Error()[:11] == "validation:"
}
