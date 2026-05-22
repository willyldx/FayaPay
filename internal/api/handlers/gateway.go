package handlers

import (
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/fayapay/faya-backend/internal/gateway"
)

// GatewayHandler handles WebSocket connections from gateway devices
// and admin status endpoints.
type GatewayHandler struct {
	hub    *gateway.Hub
	logger *zap.Logger
}

// NewGatewayHandler creates a new GatewayHandler.
func NewGatewayHandler(hub *gateway.Hub, logger *zap.Logger) *GatewayHandler {
	return &GatewayHandler{
		hub:    hub,
		logger: logger.Named("gateway-handler"),
	}
}

// UpgradeCheck is a middleware that checks if the request is a valid WebSocket upgrade.
// Must be applied before the WebSocket handler.
func (h *GatewayHandler) UpgradeCheck(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		// Pass gateway_id and operators from query params to the WebSocket handler.
		c.Locals("gateway_id", c.Query("gateway_id"))
		c.Locals("operators", c.Query("operators")) // Comma-separated: "AIRTEL,MOOV"
		return c.Next()
	}
	return c.Status(fiber.StatusUpgradeRequired).JSON(fiber.Map{
		"error": "WebSocket upgrade required",
		"code":  "UPGRADE_REQUIRED",
	})
}

// HandleWebSocket handles GET /v1/gateway/ws — upgrades to WebSocket.
// This is the entry point for gateway Android devices.
func (h *GatewayHandler) HandleWebSocket() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		gatewayID, _ := c.Locals("gateway_id").(string)
		operatorsStr, _ := c.Locals("operators").(string)

		if gatewayID == "" {
			h.logger.Warn("gateway connection rejected — missing gateway_id")
			c.Close()
			return
		}

		// FIX L4: Validate gateway_id format to prevent ID injection.
		// Reject IDs that are too long or contain non-alphanumeric characters.
		if len(gatewayID) > 64 || !isValidGatewayID(gatewayID) {
			h.logger.Warn("gateway connection rejected — invalid gateway_id format",
				zap.String("gateway_id", gatewayID),
			)
			c.Close()
			return
		}

		// Parse operators from comma-separated string.
		operators := parseOperators(operatorsStr)
		if len(operators) == 0 {
			h.logger.Warn("gateway connection rejected — no operators specified",
				zap.String("gateway_id", gatewayID),
			)
			c.Close()
			return
		}

		h.logger.Info("gateway WebSocket connected",
			zap.String("gateway_id", gatewayID),
			zap.Strings("operators", operators),
		)

		// Create a client and register with the hub.
		// We need the underlying gorilla conn — Fiber's websocket wraps it.
		client := gateway.NewClient(
			h.hub,
			c.Conn, // Access the underlying gorilla/websocket.Conn
			gatewayID,
			operators,
			h.logger,
		)

		// Register with Hub.
		h.hub.Register(client)

		// Start read/write pumps. WritePump runs in a separate goroutine.
		// ReadPump blocks until the connection is closed.
		go client.WritePump()
		client.ReadPump() // Blocks here until disconnect.
	})
}

// Status handles GET /v1/gateway/status — returns connected gateway statuses.
func (h *GatewayHandler) Status(c *fiber.Ctx) error {
	statuses := h.hub.GetConnectedGateways()

	return c.JSON(fiber.Map{
		"gateways": statuses,
		"total":    len(statuses),
	})
}

// =============================================================================
// Helpers
// =============================================================================

// parseOperators splits a comma-separated operator string into a slice.
// Filters out empty strings and validates known operators.
func parseOperators(s string) []string {
	if s == "" {
		return nil
	}

	var result []string
	current := ""
	for _, ch := range s {
		if ch == ',' {
			op := trimSpace(current)
			if op == "AIRTEL" || op == "MOOV" {
				result = append(result, op)
			}
			current = ""
		} else {
			current += string(ch)
		}
	}
	// Last segment.
	op := trimSpace(current)
	if op == "AIRTEL" || op == "MOOV" {
		result = append(result, op)
	}

	return result
}

// trimSpace removes leading and trailing spaces from a string.
func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && s[start] == ' ' {
		start++
	}
	for end > start && s[end-1] == ' ' {
		end--
	}
	return s[start:end]
}

// isValidGatewayID checks that the gateway ID contains only safe characters.
// Allowed: a-z, A-Z, 0-9, dash, underscore.
func isValidGatewayID(id string) bool {
	for _, ch := range id {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
			(ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
			return false
		}
	}
	return true
}
