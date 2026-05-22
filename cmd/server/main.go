package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/fayapay/faya-backend/internal/api"
	"github.com/fayapay/faya-backend/internal/config"
	"github.com/fayapay/faya-backend/internal/gateway"
	"github.com/fayapay/faya-backend/internal/workers"
)

func main() {
	// =========================================================================
	// 1. Load configuration
	// =========================================================================
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: failed to load config: %v\n", err)
		os.Exit(1)
	}

	// =========================================================================
	// 2. Initialize structured logger (Zap)
	// =========================================================================
	logger := initLogger(cfg)
	defer logger.Sync() //nolint:errcheck

	logger.Info("starting faya-backend",
		zap.String("env", cfg.Env),
		zap.Int("port", cfg.Port),
	)

	// =========================================================================
	// 3. Initialize PostgreSQL connection pool (pgx/v5)
	// =========================================================================
	dbPool, err := initPostgres(cfg, logger)
	if err != nil {
		logger.Fatal("failed to connect to PostgreSQL", zap.Error(err))
	}
	defer dbPool.Close()
	logger.Info("connected to PostgreSQL")

	// =========================================================================
	// 4. Initialize Redis client (go-redis/v9)
	// =========================================================================
	rdb, err := initRedis(cfg, logger)
	if err != nil {
		logger.Fatal("failed to connect to Redis", zap.Error(err))
	}
	defer rdb.Close()
	logger.Info("connected to Redis")

	// =========================================================================
	// 5. Initialize WebSocket Hub for gateway connections
	// =========================================================================
	hub := gateway.NewHub(logger)
	go hub.Run()
	logger.Info("WebSocket Hub started")

	// =========================================================================
	// 6. Initialize Asynq (task queue client + worker server)
	// =========================================================================
	asynqRedisOpt := asynq.RedisClientOpt{Addr: extractRedisAddr(cfg.RedisURL)}

	// Client — used by services to enqueue tasks.
	asynqClient := asynq.NewClient(asynqRedisOpt)
	defer asynqClient.Close()

	// Server — processes tasks in background goroutines.
	asynqServer := asynq.NewServer(asynqRedisOpt, asynq.Config{
		Concurrency: 10,
		Queues: map[string]int{
			"webhooks": 6,
			"timeouts": 3,
			"default":  1,
		},
		// FIX M7: RetryDelayFunc removed from global config. The webhook
		// backoff (1m/5m/30m/2h) is applied per-task via asynq.TaskID and
		// custom retry logic in the webhook handler, not globally.
		// The timeout scanner uses MaxRetry(1) since it runs every 60s.
	})

	// Register task handlers.
	mux := workers.RegisterHandlers(dbPool, asynqClient, cfg.WebhookTimeoutSeconds, logger)

	// Start the Asynq worker server in a separate goroutine.
	go func() {
		if err := asynqServer.Start(mux); err != nil {
			logger.Fatal("failed to start Asynq server", zap.Error(err))
		}
	}()
	logger.Info("Asynq worker server started")

	// Scheduler — enqueues periodic tasks (transaction timeout scan every 60s).
	asynqScheduler := workers.NewScheduler(asynqRedisOpt, logger)
	go func() {
		if err := asynqScheduler.Start(); err != nil {
			logger.Fatal("failed to start Asynq scheduler", zap.Error(err))
		}
	}()
	logger.Info("Asynq periodic scheduler started")

	// =========================================================================
	// 7. Mount Fiber router with all routes and middleware
	// =========================================================================
	app := fiber.New(fiber.Config{
		AppName:               "FayaPay Backend",
		DisableStartupMessage: cfg.IsProd(),
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          15 * time.Second,
		IdleTimeout:           60 * time.Second,
		// Structured error handler — all errors returned as JSON.
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
				"code":  "INTERNAL_ERROR",
			})
		},
	})

	api.SetupRouter(app, &api.Dependencies{
		DB:          dbPool,
		Redis:       rdb,
		Hub:         hub,
		AsynqClient: asynqClient,
		Config:      cfg,
		Logger:      logger,
	})
	logger.Info("Fiber router mounted")

	// =========================================================================
	// 8. Start server + graceful shutdown
	// =========================================================================
	// Channel to listen for OS interrupt/terminate signals.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Start Fiber in a goroutine.
	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		if err := app.Listen(addr); err != nil {
			logger.Fatal("failed to start Fiber server", zap.Error(err))
		}
	}()

	logger.Info("server is ready",
		zap.String("address", fmt.Sprintf("http://localhost:%d", cfg.Port)),
	)

	// Block until we receive a shutdown signal.
	sig := <-quit
	logger.Info("shutdown signal received", zap.String("signal", sig.String()))

	// Graceful shutdown with a 30-second deadline.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Stop accepting new connections, finish in-flight requests.
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		logger.Error("Fiber shutdown error", zap.Error(err))
	}

	// Stop the Asynq periodic scheduler.
	asynqScheduler.Shutdown()

	// Stop the Asynq worker server gracefully.
	asynqServer.Shutdown()

	// Stop the WebSocket Hub.
	hub.Shutdown()

	logger.Info("faya-backend stopped gracefully")
}

// =============================================================================
// Infrastructure initialization helpers
// =============================================================================

// initLogger creates a Zap logger configured for the current environment.
// Production: JSON output, Info level.
// Development: Console output with colors, Debug level.
func initLogger(cfg *config.Config) *zap.Logger {
	var zapCfg zap.Config

	if cfg.IsProd() {
		zapCfg = zap.NewProductionConfig()
		zapCfg.EncoderConfig.TimeKey = "timestamp"
		zapCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		zapCfg = zap.NewDevelopmentConfig()
		zapCfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	logger, err := zapCfg.Build()
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: failed to init logger: %v\n", err)
		os.Exit(1)
	}

	return logger
}

// initPostgres creates a pgx connection pool and verifies connectivity.
func initPostgres(cfg *config.Config, logger *zap.Logger) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	// Sensible pool defaults for a payment backend.
	poolCfg.MaxConns = 20
	poolCfg.MinConns = 5
	poolCfg.MaxConnLifetime = 1 * time.Hour
	poolCfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("creating pool: %w", err)
	}

	// Verify the connection is alive.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping failed: %w", err)
	}

	return pool, nil
}

// initRedis creates a Redis client and verifies connectivity.
func initRedis(cfg *config.Config, logger *zap.Logger) (*redis.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing Redis URL: %w", err)
	}

	rdb := redis.NewClient(opt)

	// Verify the connection is alive.
	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return rdb, nil
}

// extractRedisAddr converts a Redis URL like "redis://localhost:6379" to "localhost:6379"
// for the Asynq client which expects a host:port format.
func extractRedisAddr(redisURL string) string {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback: assume it's already in host:port format.
		return redisURL
	}
	return opt.Addr
}

// Asynq logger adapter has been moved to internal/workers/scheduler.go
// to colocate it with the worker infrastructure.
