package middleware

import (
	"crypto/subtle"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	db "github.com/kadryza/kadryza-backend/internal/db/sqlc"
	"github.com/kadryza/kadryza-backend/internal/services"
	"github.com/kadryza/kadryza-backend/pkg/crypto"
)

// Context local keys for sharing auth data between middleware and handlers.
const (
	LocalMerchantID = "merchant_id"
	LocalMerchant   = "merchant"
	LocalIsTest     = "is_test"
)

// GetIsTest reports whether the request was authenticated with a test API key.
func GetIsTest(c *fiber.Ctx) bool {
	v, _ := c.Locals(LocalIsTest).(bool)
	return v
}

// JWTAuth validates a Bearer JWT token from the Authorization header.
// Used for merchant dashboard routes (register, login, API key management).
func JWTAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract token from "Authorization: Bearer <token>".
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing Authorization header",
				"code":  "AUTH_MISSING",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid Authorization format, expected: Bearer <token>",
				"code":  "AUTH_INVALID_FORMAT",
			})
		}

		tokenString := parts[1]

		// Parse and validate the token.
		token, err := jwt.ParseWithClaims(tokenString, &services.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			// Ensure the signing method is HMAC.
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
				"code":  "AUTH_TOKEN_INVALID",
			})
		}

		claims, ok := token.Claims.(*services.JWTClaims)
		if !ok || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token claims",
				"code":  "AUTH_CLAIMS_INVALID",
			})
		}

		// Parse merchant ID from claims.
		merchantID, err := uuid.Parse(claims.MerchantID)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid merchant_id in token",
				"code":  "AUTH_MERCHANT_INVALID",
			})
		}

		// Store in Fiber locals for downstream handlers.
		c.Locals(LocalMerchantID, merchantID)

		return c.Next()
	}
}

// APIKeyAuth validates an API key from the X-API-Key header.
// Hashes the key and looks up the merchant in the database.
// Used for transaction and webhook endpoints (merchant-facing API).
func APIKeyAuth(merchantSvc *services.MerchantService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing X-API-Key header",
				"code":  "API_KEY_MISSING",
			})
		}

		// A key is either live (kadryza_live_) or test/sandbox (kadryza_test_).
		isTest := strings.HasPrefix(apiKey, crypto.TestAPIKeyPrefix)
		if !isTest && !strings.HasPrefix(apiKey, crypto.APIKeyPrefix) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid API key format",
				"code":  "API_KEY_INVALID_FORMAT",
			})
		}

		// Authenticate against the matching key (live vs test).
		var (
			merchant *db.Merchant
			err      error
		)
		if isTest {
			merchant, err = merchantSvc.AuthenticateByTestAPIKey(c.Context(), apiKey)
		} else {
			merchant, err = merchantSvc.AuthenticateByAPIKey(c.Context(), apiKey)
		}
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or revoked API key",
				"code":  "API_KEY_UNAUTHORIZED",
			})
		}

		c.Locals(LocalMerchantID, merchant.ID)
		c.Locals(LocalMerchant, merchant)
		c.Locals(LocalIsTest, isTest)
		return c.Next()
	}
}

// GatewayTokenAuth validates the gateway authentication token.
// Used for WebSocket upgrade and gateway admin endpoints.
func GatewayTokenAuth(gatewaySecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Get("X-Gateway-Token")
		if token == "" {
			token = c.Query("token") // Allow token in query for WebSocket upgrade.
		}

		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing gateway token",
				"code":  "GATEWAY_TOKEN_MISSING",
			})
		}

		// Constant-time comparison to prevent timing attacks.
		// FIX H3: Direct string comparison leaked secret length via response time.
		if subtle.ConstantTimeCompare([]byte(token), []byte(gatewaySecret)) != 1 {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid gateway token",
				"code":  "GATEWAY_TOKEN_INVALID",
			})
		}

		return c.Next()
	}
}

// GetMerchantID extracts the authenticated merchant ID from Fiber locals.
// Returns uuid.Nil and false if not found (middleware not applied).
func GetMerchantID(c *fiber.Ctx) (uuid.UUID, bool) {
	id, ok := c.Locals(LocalMerchantID).(uuid.UUID)
	return id, ok
}

// EmailVerifiedGuard blocks access if the merchant's email is not verified.
// Must be applied AFTER APIKeyAuth (which sets merchant_id in locals).
// Returns 403 with code EMAIL_NOT_VERIFIED if the merchant's email is unverified.
func EmailVerifiedGuard(merchantSvc *services.MerchantService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		merchantID, ok := GetMerchantID(c)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
				"code":  "AUTH_REQUIRED",
			})
		}

		verified, err := merchantSvc.IsEmailVerified(c.Context(), merchantID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "internal error",
				"code":  "INTERNAL_ERROR",
			})
		}

		if !verified {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Email non vérifié",
				"code":  "EMAIL_NOT_VERIFIED",
			})
		}

		return c.Next()
	}
}
