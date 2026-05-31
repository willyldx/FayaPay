package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration values for the application.
// All fields are populated from environment variables via Viper.
type Config struct {
	// Server
	Port int    `mapstructure:"PORT"`
	Env  string `mapstructure:"ENV"`

	// PostgreSQL
	DatabaseURL string `mapstructure:"DATABASE_URL"`

	// Redis
	RedisURL string `mapstructure:"REDIS_URL"`

	// JWT
	JWTSecret string        `mapstructure:"JWT_SECRET"`
	JWTExpiry time.Duration `mapstructure:"JWT_EXPIRY"`

	// Gateway WebSocket
	GatewayTokenSecret string `mapstructure:"GATEWAY_TOKEN_SECRET"`

	// Webhook
	WebhookTimeoutSeconds int `mapstructure:"WEBHOOK_TIMEOUT_SECONDS"`

	// Transaction
	TransactionTimeoutMinutes int `mapstructure:"TRANSACTION_TIMEOUT_MINUTES"`

	// CORS
	CORSOrigins string `mapstructure:"CORS_ORIGINS"`

	// SMTP — Email sending
	SMTPHost     string `mapstructure:"SMTP_HOST"`
	SMTPPort     int    `mapstructure:"SMTP_PORT"`
	SMTPUser     string `mapstructure:"SMTP_USER"`
	SMTPPassword string `mapstructure:"SMTP_PASSWORD"`
	SMTPFrom     string `mapstructure:"SMTP_FROM"`

	// App URL — used in email templates for links
	AppURL string `mapstructure:"APP_URL"`

	// KYC — root directory where uploaded KYC documents are stored on disk.
	KYCUploadDir string `mapstructure:"KYC_UPLOAD_DIR"`

	// KYC — maximum accepted upload size in bytes.
	KYCMaxUploadBytes int64 `mapstructure:"KYC_MAX_UPLOAD_BYTES"`
}

// IsProd returns true if the environment is set to production.
func (c *Config) IsProd() bool {
	return strings.EqualFold(c.Env, "production")
}

// Load reads configuration from .env file and environment variables.
// Environment variables take precedence over .env values.
func Load() (*Config, error) {
	v := viper.New()

	// --- Defaults ---
	v.SetDefault("PORT", 8080)
	v.SetDefault("ENV", "development")
	v.SetDefault("REDIS_URL", "redis://localhost:6379")
	v.SetDefault("JWT_EXPIRY", "24h")
	v.SetDefault("WEBHOOK_TIMEOUT_SECONDS", 10)
	v.SetDefault("TRANSACTION_TIMEOUT_MINUTES", 5)
	v.SetDefault("SMTP_PORT", 587)
	v.SetDefault("SMTP_FROM", "noreply@spencerai.tech")
	v.SetDefault("APP_URL", "http://localhost:3000")
	v.SetDefault("KYC_UPLOAD_DIR", "./uploads/kyc")
	v.SetDefault("KYC_MAX_UPLOAD_BYTES", 10*1024*1024) // 10 MB

	// --- .env file ---
	v.SetConfigFile(".env")
	v.SetConfigType("env")

	// Don't fail if .env doesn't exist — we can rely on real env vars.
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Only warn, don't fail — env vars might be set directly.
			fmt.Printf("Warning: could not read .env file: %v\n", err)
		}
	}

	// --- Environment variables override .env ---
	v.AutomaticEnv()

	// --- Parse into struct ---
	cfg := &Config{}

	// Viper doesn't natively unmarshal time.Duration from strings like "24h",
	// so we handle JWTExpiry manually.
	cfg.Port = v.GetInt("PORT")
	cfg.Env = v.GetString("ENV")
	cfg.DatabaseURL = v.GetString("DATABASE_URL")
	cfg.RedisURL = v.GetString("REDIS_URL")
	cfg.JWTSecret = v.GetString("JWT_SECRET")
	cfg.GatewayTokenSecret = v.GetString("GATEWAY_TOKEN_SECRET")
	cfg.WebhookTimeoutSeconds = v.GetInt("WEBHOOK_TIMEOUT_SECONDS")
	cfg.TransactionTimeoutMinutes = v.GetInt("TRANSACTION_TIMEOUT_MINUTES")
	cfg.CORSOrigins = v.GetString("CORS_ORIGINS")
	cfg.SMTPHost = v.GetString("SMTP_HOST")
	cfg.SMTPPort = v.GetInt("SMTP_PORT")
	cfg.SMTPUser = v.GetString("SMTP_USER")
	cfg.SMTPPassword = v.GetString("SMTP_PASSWORD")
	cfg.SMTPFrom = v.GetString("SMTP_FROM")
	cfg.AppURL = v.GetString("APP_URL")
	cfg.KYCUploadDir = v.GetString("KYC_UPLOAD_DIR")
	cfg.KYCMaxUploadBytes = v.GetInt64("KYC_MAX_UPLOAD_BYTES")

	// Parse JWT expiry as a duration string (e.g. "24h", "30m").
	expiryStr := v.GetString("JWT_EXPIRY")
	expiry, err := time.ParseDuration(expiryStr)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRY value %q: %w", expiryStr, err)
	}
	cfg.JWTExpiry = expiry

	// --- Validate required fields ---
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

// validate checks that all required configuration values are present.
func (c *Config) validate() error {
	var missing []string

	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.JWTSecret == "" || len(c.JWTSecret) < 32 || c.JWTSecret == "change_me_to_a_long_random_secret" {
		missing = append(missing, "JWT_SECRET (must be at least 32 characters)")
	}
	if c.GatewayTokenSecret == "" || len(c.GatewayTokenSecret) < 32 || c.GatewayTokenSecret == "change_me_to_another_long_random_secret" {
		missing = append(missing, "GATEWAY_TOKEN_SECRET (must be at least 32 characters)")
	}
	if c.Port < 1 || c.Port > 65535 {
		missing = append(missing, "PORT (must be between 1 and 65535)")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing or invalid configuration: %s", strings.Join(missing, ", "))
	}

	return nil
}
