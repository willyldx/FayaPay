package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/kadryza/kadryza-backend/internal/api/handlers"
	"github.com/kadryza/kadryza-backend/internal/api/middleware"
	"github.com/kadryza/kadryza-backend/internal/config"
	"github.com/kadryza/kadryza-backend/internal/gateway"
	"github.com/kadryza/kadryza-backend/internal/services"
)

// Dependencies holds all shared dependencies injected into route handlers.
type Dependencies struct {
	DB          *pgxpool.Pool
	Redis       *redis.Client
	Hub         *gateway.Hub
	AsynqClient *asynq.Client
	Config      *config.Config
	Logger      *zap.Logger
}

// SetupRouter mounts all API routes and middleware onto the Fiber app.
func SetupRouter(app *fiber.App, deps *Dependencies) {
	// =========================================================================
	// Global middleware
	// =========================================================================

	// Panic recovery — prevent crashes from killing the server.
	app.Use(recover.New())

	// CORS — restrict to known origins. Configurable via CORS_ORIGINS env var.
	// FIX H2: Wildcard was dangerous for JWT-protected dashboard routes.
	allowedOrigins := "http://localhost:3000,http://localhost:5173"
	if deps.Config.CORSOrigins != "" {
		allowedOrigins = deps.Config.CORSOrigins
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-API-Key, X-Gateway-Token",
		AllowMethods:     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// Structured request logging via Zap.
	app.Use(middleware.RequestLogger(deps.Logger))

	// =========================================================================
	// Health & readiness — no auth required
	// =========================================================================

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/ready", func(c *fiber.Ctx) error {
		if err := deps.DB.Ping(c.Context()); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status": "not ready",
				"error":  "database unreachable",
				"code":   "DB_UNAVAILABLE",
			})
		}
		if err := deps.Redis.Ping(c.Context()).Err(); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status": "not ready",
				"error":  "redis unreachable",
				"code":   "REDIS_UNAVAILABLE",
			})
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	// =========================================================================
	// Initialize services
	// =========================================================================

	emailSvc := services.NewEmailService(deps.Config, deps.Logger)
	merchantSvc := services.NewMerchantService(deps.DB, deps.Config, deps.Logger, emailSvc)
	transactionSvc := services.NewTransactionService(deps.DB, deps.Hub, deps.AsynqClient, emailSvc, deps.Logger)
	webhookSvc := services.NewWebhookService(deps.DB, deps.AsynqClient, deps.Config, deps.Logger)
	paymentLinkSvc := services.NewPaymentLinkService(deps.DB, deps.Config, deps.Logger)

	// =========================================================================
	// Initialize handlers
	// =========================================================================

	merchantHandler := handlers.NewMerchantHandler(merchantSvc, deps.Logger)
	transactionHandler := handlers.NewTransactionHandler(transactionSvc, deps.Logger)
	webhookHandler := handlers.NewWebhookHandler(webhookSvc, deps.Logger)
	gatewayHandler := handlers.NewGatewayHandler(deps.Hub, deps.Logger)
	paymentLinkHandler := handlers.NewPaymentLinkHandler(paymentLinkSvc, transactionSvc, deps.Logger)

	// =========================================================================
	// API v1 routes
	// =========================================================================

	v1 := app.Group("/v1")

	// --- Auth routes (public: register & login, JWT-protected: API keys) ---
	// FIX H4: Aggressive rate limiting on auth (5 req/min) to prevent brute-force.
	authLimiter := middleware.RateLimit(deps.Redis, middleware.RateLimitConfig{
		MaxRequests: 5,
		Window:      1 * time.Minute,
	})
	auth := v1.Group("/auth")
	auth.Post("/register", authLimiter, merchantHandler.Register)
	auth.Post("/login", authLimiter, merchantHandler.Login)
	auth.Get("/verify/:token", merchantHandler.VerifyEmail)
	auth.Post("/resend-verification", authLimiter, merchantHandler.ResendVerification)
	auth.Post("/forgot-password", authLimiter, merchantHandler.ForgotPassword)
	auth.Post("/reset-password/:token", merchantHandler.ResetPassword)

	// JWT-protected auth routes.
	authProtected := auth.Group("", middleware.JWTAuth(deps.Config.JWTSecret))
	authProtected.Get("/api-keys", merchantHandler.ListAPIKeys)
	authProtected.Post("/api-keys", merchantHandler.GenerateAPIKey)
	authProtected.Delete("/api-keys/:id", merchantHandler.RevokeAPIKey)
	authProtected.Get("/me", merchantHandler.GetProfile)
	authProtected.Patch("/change-password", merchantHandler.ChangePassword)

	// --- Merchant profile routes (JWT auth) — portail merchant ---
	merchants := v1.Group("/merchants", middleware.JWTAuth(deps.Config.JWTSecret))
	merchants.Patch("/profile", merchantHandler.UpdateProfile)

	// --- Payment links (JWT auth) — dashboard management ---
	paymentLinks := v1.Group("/payment-links", middleware.JWTAuth(deps.Config.JWTSecret))
	paymentLinks.Post("/", paymentLinkHandler.Create)
	paymentLinks.Get("/", paymentLinkHandler.List)
	paymentLinks.Get("/:id", paymentLinkHandler.Get)
	paymentLinks.Patch("/:id", paymentLinkHandler.SetActive)
	paymentLinks.Delete("/:id", paymentLinkHandler.Delete)

	// --- Public hosted checkout (no auth, rate-limited) ---
	// FIX: /tx/:id is registered before /:slug so the status route is matched first.
	checkout := v1.Group("/checkout",
		middleware.RateLimit(deps.Redis, middleware.DefaultRateLimitConfig()),
	)
	checkout.Get("/tx/:id", paymentLinkHandler.CheckoutStatus)
	checkout.Get("/:slug", paymentLinkHandler.GetCheckout)
	checkout.Post("/:slug/pay", paymentLinkHandler.Pay)

	// --- Transaction routes (API Key auth + email verification + rate limiting) ---
	transactions := v1.Group("/transactions",
		middleware.APIKeyAuth(merchantSvc),
		middleware.EmailVerifiedGuard(merchantSvc),
		middleware.RateLimit(deps.Redis, middleware.DefaultRateLimitConfig()),
	)
	transactions.Post("/", transactionHandler.Initiate)
	// FIX H5: List MUST be registered before /:id — otherwise Fiber matches
	// GET /v1/transactions/ as /:id with id="", returning 400 instead of the list.
	transactions.Get("/", transactionHandler.List)
	transactions.Get("/:id", transactionHandler.GetByID)

	// --- Webhook routes (API Key auth + email verification) ---
	webhooks := v1.Group("/webhooks",
		middleware.APIKeyAuth(merchantSvc),
		middleware.EmailVerifiedGuard(merchantSvc),
	)
	webhooks.Post("/", webhookHandler.Create)
	webhooks.Get("/", webhookHandler.List)
	webhooks.Delete("/:id", webhookHandler.Delete)
	webhooks.Post("/:id/test", webhookHandler.Test)

	// --- Gateway routes (gateway token auth) ---
	gw := v1.Group("/gateway",
		middleware.GatewayTokenAuth(deps.Config.GatewayTokenSecret),
	)
	gw.Get("/ws", gatewayHandler.UpgradeCheck, gatewayHandler.HandleWebSocket())
	gw.Get("/status", gatewayHandler.Status)

	// --- Dashboard routes (JWT auth) — lecture seule pour le portail merchant ---
	// Ces routes permettent au dashboard web d'afficher les données via JWT Bearer.
	dashboard := v1.Group("/dashboard", middleware.JWTAuth(deps.Config.JWTSecret))
	dashboard.Get("/transactions", transactionHandler.List)
	dashboard.Get("/transactions/:id", transactionHandler.GetByID)
	dashboard.Get("/webhooks", webhookHandler.List)
	dashboard.Post("/webhooks", webhookHandler.Create)
	dashboard.Delete("/webhooks/:id", webhookHandler.Delete)
	dashboard.Post("/webhooks/:id/test", webhookHandler.Test)
	dashboard.Get("/gateway/status", gatewayHandler.Status)
}
