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
	if c.JWTSecret == "" || c.JWTSecret == "change_me_to_a_long_random_secret" {
		missing = append(missing, "JWT_SECRET (must be changed from default)")
	}
	if c.GatewayTokenSecret == "" || c.GatewayTokenSecret == "change_me_to_another_long_random_secret" {
		missing = append(missing, "GATEWAY_TOKEN_SECRET (must be changed from default)")
	}
	if c.Port < 1 || c.Port > 65535 {
		missing = append(missing, "PORT (must be between 1 and 65535)")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing or invalid configuration: %s", strings.Join(missing, ", "))
	}

	return nil
}
