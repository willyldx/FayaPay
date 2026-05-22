package com.kadryza.gateway.core

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import timber.log.Timber
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypts and decrypts sensitive data using Android Keystore.
 *
 * Uses AES-256-GCM, which provides both confidentiality and integrity.
 * The key is stored in hardware-backed keystore (TEE/StrongBox when available)
 * and never leaves the secure enclave.
 *
 * Usage:
 *   val encrypted = SecureStorage.encrypt("my_secret")
 *   val decrypted = SecureStorage.decrypt(encrypted)
 *
 * Format of encrypted output: Base64(IV[12 bytes] + ciphertext + authTag[16 bytes])
 */
object SecureStorage {

    private const val KEY_ALIAS = "kadryza_gateway_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH = 128  // bits
    private const val GCM_IV_LENGTH = 12    // bytes

    /**
     * Encrypts plaintext using AES-GCM with the app's master key.
     * Returns a Base64-encoded string containing IV + ciphertext.
     */
    fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv  // GCM generates a random IV
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        // Concatenate IV + ciphertext for storage
        val combined = ByteArray(iv.size + ciphertext.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Decrypts a Base64-encoded string produced by [encrypt].
     * Returns null if decryption fails (corrupted data, wrong key, tampered).
     */
    fun decrypt(encoded: String): String? {
        return try {
            val combined = Base64.decode(encoded, Base64.NO_WRAP)
            if (combined.size < GCM_IV_LENGTH + 1) {
                Timber.e("SecureStorage — Encrypted data too short (${combined.size} bytes)")
                return null
            }
            val iv = combined.sliceArray(0 until GCM_IV_LENGTH)
            val ciphertext = combined.sliceArray(GCM_IV_LENGTH until combined.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_LENGTH, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        } catch (e: Exception) {
            Timber.e(e, "SecureStorage — Decryption failed")
            null
        }
    }

    /**
     * Gets the existing master key from Android Keystore, or creates one.
     * The key is backed by hardware (TEE) on supported devices.
     */
    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existingEntry = keyStore.getEntry(KEY_ALIAS, null)
        if (existingEntry is KeyStore.SecretKeyEntry) {
            return existingEntry.secretKey
        }

        // Generate a new AES-256 key
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        val key = keyGenerator.generateKey()
        Timber.i("SecureStorage — Generated new master key in AndroidKeyStore")
        return key
    }
}
