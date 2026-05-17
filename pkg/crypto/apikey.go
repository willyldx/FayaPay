package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
)

const (
	// APIKeyPrefix is prepended to every generated API key for identification.
	APIKeyPrefix = "faya_live_"

	// keyLength is the number of random characters after the prefix.
	keyLength = 32

	// charset used for the random portion of the API key.
	charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

// GenerateAPIKey creates a new API key in the format: faya_live_<32 random chars>.
// The returned key should be shown to the merchant ONCE and never stored in plaintext.
// Only its SHA-256 hash is persisted in the database.
func GenerateAPIKey() (key string, prefix string, err error) {
	buf := make([]byte, keyLength)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("crypto/rand failed: %w", err)
	}

	// Map each random byte to a character in the charset.
	// Using modulo introduces negligible bias given charset length (62) vs byte range (256).
	for i := range buf {
		buf[i] = charset[buf[i]%byte(len(charset))]
	}

	fullKey := APIKeyPrefix + string(buf)
	return fullKey, APIKeyPrefix, nil
}

// HashAPIKey computes the SHA-256 hash of an API key for secure storage.
// This is the value stored in the merchants.api_key_hash column.
func HashAPIKey(rawKey string) string {
	hash := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(hash[:])
}

// VerifyAPIKey checks if a raw API key matches a stored SHA-256 hash.
// Uses constant-time comparison to prevent timing attacks.
func VerifyAPIKey(rawKey, storedHash string) bool {
	computed := HashAPIKey(rawKey)
	return subtle.ConstantTimeCompare([]byte(computed), []byte(storedHash)) == 1
}

// GenerateWebhookSecret creates a random 32-byte hex secret for HMAC-SHA256 webhook signing.
func GenerateWebhookSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("crypto/rand failed: %w", err)
	}
	return hex.EncodeToString(buf), nil
}
