package handlers

import (
	"errors"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/kadryza/kadryza-backend/internal/api/middleware"
	"github.com/kadryza/kadryza-backend/internal/models"
	"github.com/kadryza/kadryza-backend/internal/services"
)

// KYCHandler handles the merchant KYC flow (business profile, documents,
// submission) and the back-office review endpoint.
type KYCHandler struct {
	service *services.KYCService
	logger  *zap.Logger
}

// NewKYCHandler creates a new KYCHandler.
func NewKYCHandler(service *services.KYCService, logger *zap.Logger) *KYCHandler {
	return &KYCHandler{
		service: service,
		logger:  logger.Named("kyc-handler"),
	}
}

// GetStatus handles GET /v1/kyc/status
func (h *KYCHandler) GetStatus(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	status, err := h.service.GetStatus(c.Context(), merchantID)
	if err != nil {
		return h.mapError(c, err, "failed to load kyc status")
	}
	return c.JSON(status)
}

// UpdateProfile handles PATCH /v1/kyc/profile
func (h *KYCHandler) UpdateProfile(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	var req models.UpdateKYCProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	if req.BusinessType != nil && *req.BusinessType != "" && !models.IsValidBusinessType(*req.BusinessType) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "business_type must be 'individual' or 'company'",
			"code":  "VALIDATION_ERROR",
		})
	}

	merchant, err := h.service.UpdateProfile(c.Context(), merchantID, req)
	if err != nil {
		return h.mapError(c, err, "failed to update kyc profile")
	}
	return c.JSON(merchant)
}

// UploadDocument handles POST /v1/kyc/documents (multipart/form-data).
// Fields: doc_type (text), file (binary).
func (h *KYCHandler) UploadDocument(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	docType := c.FormValue("doc_type")
	if docType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "doc_type is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "a file upload is required (field 'file')",
			"code":  "VALIDATION_ERROR",
		})
	}

	f, err := fileHeader.Open()
	if err != nil {
		h.logger.Error("opening uploaded file failed", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "could not read uploaded file",
			"code":  "INVALID_FILE",
		})
	}
	defer f.Close()

	// Sniff the real content type from the first 512 bytes rather than trusting
	// the client-supplied part header, then rewind for the full copy.
	head := make([]byte, 512)
	n, _ := f.Read(head)
	mimeType := http.DetectContentType(head[:n])
	if _, err := f.Seek(0, 0); err != nil {
		h.logger.Error("seeking uploaded file failed", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "could not process uploaded file",
			"code":  "INTERNAL_ERROR",
		})
	}

	doc, err := h.service.UploadDocument(c.Context(), merchantID, docType, fileHeader.Filename, mimeType, fileHeader.Size, f)
	if err != nil {
		return h.mapError(c, err, "failed to upload document")
	}
	return c.Status(fiber.StatusCreated).JSON(doc)
}

// ListDocuments handles GET /v1/kyc/documents
func (h *KYCHandler) ListDocuments(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	docs, err := h.service.ListDocuments(c.Context(), merchantID)
	if err != nil {
		return h.mapError(c, err, "failed to list documents")
	}
	return c.JSON(docs)
}

// DeleteDocument handles DELETE /v1/kyc/documents/:id
func (h *KYCHandler) DeleteDocument(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	docID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid document id",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.service.DeleteDocument(c.Context(), merchantID, docID); err != nil {
		return h.mapError(c, err, "failed to delete document")
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// Submit handles POST /v1/kyc/submit
func (h *KYCHandler) Submit(c *fiber.Ctx) error {
	merchantID, ok := middleware.GetMerchantID(c)
	if !ok {
		return unauthorized(c)
	}

	merchant, err := h.service.Submit(c.Context(), merchantID)
	if err != nil {
		return h.mapError(c, err, "failed to submit kyc")
	}
	return c.JSON(merchant)
}

// mapError translates service errors to HTTP responses.
func (h *KYCHandler) mapError(c *fiber.Ctx, err error, internalMsg string) error {
	switch {
	case errors.Is(err, services.ErrMerchantNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "merchant not found", "code": "NOT_FOUND"})
	case errors.Is(err, services.ErrKYCDocumentNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "document not found", "code": "NOT_FOUND"})
	case errors.Is(err, services.ErrKYCAlreadyVerified):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "kyc is already verified", "code": "KYC_ALREADY_VERIFIED"})
	case errors.Is(err, services.ErrKYCInvalidTransition):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "kyc cannot be submitted from the current status", "code": "KYC_INVALID_TRANSITION"})
	case errors.Is(err, services.ErrKYCProfileIncomplete):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "business profile is incomplete (business_type and legal_name are required)", "code": "KYC_PROFILE_INCOMPLETE"})
	case errors.Is(err, services.ErrKYCNoDocuments):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "at least one document is required before submitting", "code": "KYC_NO_DOCUMENTS"})
	case errors.Is(err, services.ErrKYCInvalidDocType):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported document type", "code": "KYC_INVALID_DOC_TYPE"})
	case errors.Is(err, services.ErrKYCInvalidMimeType):
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{"error": "unsupported file type (allowed: jpeg, png, webp, pdf)", "code": "KYC_INVALID_MIME"})
	case errors.Is(err, services.ErrKYCFileTooLarge):
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "file exceeds the maximum allowed size", "code": "KYC_FILE_TOO_LARGE"})
	default:
		h.logger.Error(internalMsg, zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": internalMsg, "code": "INTERNAL_ERROR"})
	}
}

// unauthorized is the shared 401 response for KYC routes.
func unauthorized(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"error": "authentication required",
		"code":  "AUTH_REQUIRED",
	})
}
