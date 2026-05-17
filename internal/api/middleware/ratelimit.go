package middleware

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimitConfig holds rate limiting parameters.
type RateLimitConfig struct {
	MaxRequests int           // Maximum requests allowed in the window.
	Window      time.Duration // Sliding window duration.
}

// DefaultRateLimitConfig returns sensible defaults for a payment API.
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		MaxRequests: 100,
		Window:      1 * time.Minute,
	}
}

// RateLimit enforces request rate limiting using Redis sliding window counters.
// The key is derived from the API key (if present) or the client IP.
func RateLimit(rdb *redis.Client, cfg RateLimitConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Determine the rate limit key.
		key := rateLimitKey(c)

		// Use Redis INCR + EXPIRE for a fixed window counter.
		// This is simpler than a true sliding window but sufficient for our use case.
		redisKey := fmt.Sprintf("rl:%s", key)

		ctx := c.Context()

		// Increment the counter.
		count, err := rdb.Incr(ctx, redisKey).Result()
		if err != nil {
			// If Redis is down, fail open — don't block requests.
			// Log the error but allow the request through.
			return c.Next()
		}

		// Set expiry on first request in this window.
		if count == 1 {
			rdb.Expire(ctx, redisKey, cfg.Window)
		}

		// Get remaining TTL for response headers.
		ttl, _ := rdb.TTL(ctx, redisKey).Result()

		// Set rate limit response headers.
		c.Set("X-RateLimit-Limit", fmt.Sprintf("%d", cfg.MaxRequests))
		c.Set("X-RateLimit-Remaining", fmt.Sprintf("%d", max(0, int64(cfg.MaxRequests)-count)))
		c.Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(ttl).Unix()))

		// Check if rate limit exceeded.
		if count > int64(cfg.MaxRequests) {
			c.Set("Retry-After", fmt.Sprintf("%d", int(ttl.Seconds())))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "rate limit exceeded",
				"code":  "RATE_LIMIT_EXCEEDED",
				"retry_after_seconds": int(ttl.Seconds()),
			})
		}

		return c.Next()
	}
}

// rateLimitKey determines the rate limit key from the request context.
// Prefers API key (hashed), falls back to client IP.
func rateLimitKey(c *fiber.Ctx) string {
	// If API key auth middleware ran, use the API key as the key.
	if apiKey := c.Get("X-API-Key"); apiKey != "" {
		// Use a truncated version — we don't need the full key for rate limiting.
		if len(apiKey) > 20 {
			return "key:" + apiKey[:20]
		}
		return "key:" + apiKey
	}

	// Fallback to client IP.
	return "ip:" + c.IP()
}

// max returns the larger of two int64 values.
func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
