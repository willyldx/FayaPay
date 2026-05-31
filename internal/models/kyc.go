package models

import (
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// KYC — statuses, document types
// =============================================================================

// KYC status values — must stay in sync with the CHECK constraint on
// merchants.kyc_status (migration 009).
const (
	KYCStatusUnverified = "unverified"
	KYCStatusPending    = "pending"
	KYCStatusVerified   = "verified"
	KYCStatusRejected   = "rejected"
)

// Business types — must stay in sync with the CHECK constraint on
// merchants.business_type.
const (
	BusinessTypeIndividual = "individual"
	BusinessTypeCompany    = "company"
)

// KYC document types accepted by the upload endpoint.
const (
	KYCDocIDCard          = "ID_CARD"
	KYCDocPassport        = "PASSPORT"
	KYCDocRCCM            = "RCCM"
	KYCDocNIF             = "NIF"
	KYCDocProofOfAddress  = "PROOF_OF_ADDRESS"
	KYCDocSelfie          = "SELFIE"
	KYCDocOther           = "OTHER"
)

// IsValidKYCDocType reports whether t is an accepted document type.
func IsValidKYCDocType(t string) bool {
	switch t {
	case KYCDocIDCard, KYCDocPassport, KYCDocRCCM, KYCDocNIF,
		KYCDocProofOfAddress, KYCDocSelfie, KYCDocOther:
		return true
	default:
		return false
	}
}

// IsValidBusinessType reports whether t is an accepted business type.
func IsValidBusinessType(t string) bool {
	return t == BusinessTypeIndividual || t == BusinessTypeCompany
}

// IsValidKYCStatus reports whether s is an accepted KYC status (used by the
// admin/back-office review endpoint).
func IsValidKYCStatus(s string) bool {
	switch s {
	case KYCStatusUnverified, KYCStatusPending, KYCStatusVerified, KYCStatusRejected:
		return true
	default:
		return false
	}
}

// =============================================================================
// Requests
// =============================================================================

// UpdateKYCProfileRequest is the payload for updating a merchant's business
// profile. All fields are optional — only non-nil fields are applied (PATCH
// semantics), letting the merchant fill the form progressively.
type UpdateKYCProfileRequest struct {
	BusinessType *string `json:"business_type" validate:"omitempty,oneof=individual company"`
	LegalName    *string `json:"legal_name" validate:"omitempty,max=255"`
	RCCM         *string `json:"rccm" validate:"omitempty,max=100"`
	NIF          *string `json:"nif" validate:"omitempty,max=100"`
	ContactPhone *string `json:"contact_phone" validate:"omitempty,max=20"`
	Address      *string `json:"address" validate:"omitempty,max=500"`
}

// SetKYCStatusRequest is the back-office review outcome payload.
type SetKYCStatusRequest struct {
	Status          string  `json:"status" validate:"required,oneof=unverified pending verified rejected"`
	RejectionReason *string `json:"rejection_reason" validate:"omitempty,max=500"`
}

// =============================================================================
// Responses
// =============================================================================

// KYCDocumentPublic is the safe representation of an uploaded KYC document.
// The on-disk file_path is intentionally never exposed to clients.
type KYCDocumentPublic struct {
	ID         uuid.UUID `json:"id"`
	DocType    string    `json:"doc_type"`
	FileName   *string   `json:"file_name,omitempty"`
	MimeType   *string   `json:"mime_type,omitempty"`
	SizeBytes  *int64    `json:"size_bytes,omitempty"`
	Status     string    `json:"status"`
	UploadedAt time.Time `json:"uploaded_at"`
}

// KYCStatusResponse is the aggregate KYC view returned to the merchant portal.
type KYCStatusResponse struct {
	Status          string              `json:"status"`
	BusinessType    *string             `json:"business_type,omitempty"`
	LegalName       *string             `json:"legal_name,omitempty"`
	RCCM            *string             `json:"rccm,omitempty"`
	NIF             *string             `json:"nif,omitempty"`
	ContactPhone    *string             `json:"contact_phone,omitempty"`
	Address         *string             `json:"address,omitempty"`
	SubmittedAt     *time.Time          `json:"submitted_at,omitempty"`
	ReviewedAt      *time.Time          `json:"reviewed_at,omitempty"`
	RejectionReason *string             `json:"rejection_reason,omitempty"`
	Documents       []KYCDocumentPublic `json:"documents"`
}
