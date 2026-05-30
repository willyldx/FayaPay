package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
)

const (
	// APIKeyPrefix is prepended to every generated live API key.
	APIKeyPrefix = "kadryza_live_"

	// TestAPIKeyPrefix is prepended to sandbox/test API keys.
	TestAPIKeyPrefix = "kadryza_test_"

	// keyLength is the number of random characters after the prefix.
	keyLength = 32

	// charset used for the random portion of the API key.
	charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

// GenerateAPIKey creates a new live API key (kadryza_live_<32 random chars>).
// The returned key should be shown to the merchant ONCE and never stored in plaintext.
func GenerateAPIKey() (key string, prefix string, err error) {
	return generateKey(APIKeyPrefix)
}

// GenerateTestAPIKey creates a new sandbox API key (kadryza_test_<32 random chars>).
func GenerateTestAPIKey() (key string, prefix string, err error) {
	return generateKey(TestAPIKeyPrefix)
}

// generateKey produces a random API key with the given prefix.
func generateKey(keyPrefix string) (key string, prefix string, err error) {
	buf := make([]byte, keyLength)

	// FIX L5: Rejection sampling eliminates modulo bias.
	charsetLen := byte(len(charset))
	maxUnbiased := byte(256 - (256 % int(charsetLen))) // 248
	for i := 0; i < keyLength; i++ {
		for {
			b := make([]byte, 1)
			if _, err := rand.Read(b); err != nil {
				return "", "", fmt.Errorf("crypto/rand failed: %w", err)
			}
			if b[0] < maxUnbiased {
				buf[i] = charset[b[0]%charsetLen]
				break
			}
			// Reject and retry (~3% chance per iteration).
		}
	}

	fullKey := keyPrefix + string(buf)
	return fullKey, keyPrefix, nil
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
