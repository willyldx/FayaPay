package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// RequestLogger logs every HTTP request with structured fields via Zap.
// Production: JSON output. Development: human-readable with colors.
func RequestLogger(logger *zap.Logger) fiber.Handler {
	log := logger.Named("http")

	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process the request.
		err := c.Next()

		// Calculate latency.
		latency := time.Since(start)
		status := c.Response().StatusCode()

		// Build log fields.
		fields := []zap.Field{
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("ip", c.IP()),
			zap.String("user_agent", c.Get("User-Agent")),
			zap.Int("body_size", len(c.Response().Body())),
		}

		// Add request ID if present.
		if reqID := c.Get("X-Request-ID"); reqID != "" {
			fields = append(fields, zap.String("request_id", reqID))
		}

		// Add merchant ID if authenticated.
		if merchantID, ok := GetMerchantID(c); ok {
			fields = append(fields, zap.String("merchant_id", merchantID.String()))
		}

		// Log at appropriate level based on status code.
		switch {
		case status >= 500:
			log.Error("server error", fields...)
		case status >= 400:
			log.Warn("client error", fields...)
		default:
			log.Info("request", fields...)
		}

		return err
	}
}
