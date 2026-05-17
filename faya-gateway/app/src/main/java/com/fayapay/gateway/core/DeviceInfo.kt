package com.fayapay.gateway.core

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import timber.log.Timber
import java.util.UUID

/**
 * Manages the unique, persistent identity of this gateway device.
 *
 * The gateway_id is a UUID generated exactly once on first launch,
 * stored in DataStore, and never regenerated. This is the identity
 * the backend uses to track this physical device.
 *
 * PRD rule #5: "Gateway ID généré une seule fois au premier lancement,
 * stocké en DataStore, jamais régénéré"
 */
class DeviceInfo(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val KEY_GATEWAY_ID = stringPreferencesKey("gateway_id")
        private val KEY_BACKEND_URL = stringPreferencesKey("backend_url")
        private val KEY_GATEWAY_TOKEN = stringPreferencesKey("gateway_token")
        private val KEY_HEARTBEAT_INTERVAL = stringPreferencesKey("heartbeat_interval_ms")
        private val KEY_AIRTEL_SENDER_NUMBERS = stringPreferencesKey("airtel_sender_numbers")
        private val KEY_MOOV_SENDER_NUMBERS = stringPreferencesKey("moov_sender_numbers")
        private val KEY_AIRTEL_USSD_CODE = stringPreferencesKey("airtel_ussd_code")
        private val KEY_MOOV_USSD_CODE = stringPreferencesKey("moov_ussd_code")

        // Defaults
        const val DEFAULT_BACKEND_URL = "wss://api.fayapay.app/v1/gateway/ws"
        const val DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000L
    }

    /**
     * Returns the gateway ID, generating and persisting it on first call.
     * This is a suspend function because DataStore I/O is async.
     *
     * Thread-safe: DataStore handles concurrent access internally.
     */
    suspend fun getGatewayId(): String {
        val existing = dataStore.data.map { prefs ->
            prefs[KEY_GATEWAY_ID]
        }.first()

        if (existing != null) {
            return existing
        }

        // First launch — generate and persist
        val newId = UUID.randomUUID().toString()
        dataStore.edit { prefs ->
            // Double-check inside edit transaction to prevent race
            if (prefs[KEY_GATEWAY_ID] == null) {
                prefs[KEY_GATEWAY_ID] = newId
                Timber.i("DeviceInfo — Generated new gateway_id: $newId")
            }
        }

        // Re-read to return whatever won the race (if any)
        return dataStore.data.map { it[KEY_GATEWAY_ID]!! }.first()
    }

    /**
     * Returns the backend WebSocket URL.
     */
    suspend fun getBackendUrl(): String {
        return dataStore.data.map { prefs ->
            prefs[KEY_BACKEND_URL] ?: DEFAULT_BACKEND_URL
        }.first()
    }

    /**
     * Returns the gateway authentication token (JWT).
     * Returns null if not yet configured.
     */
    suspend fun getGatewayToken(): String? {
        return dataStore.data.map { prefs ->
            prefs[KEY_GATEWAY_TOKEN]
        }.first()
    }

    /**
     * Returns the heartbeat interval in milliseconds.
     */
    suspend fun getHeartbeatIntervalMs(): Long {
        return dataStore.data.map { prefs ->
            prefs[KEY_HEARTBEAT_INTERVAL]?.toLongOrNull() ?: DEFAULT_HEARTBEAT_INTERVAL_MS
        }.first()
    }

    /**
     * Returns Airtel sender numbers (short codes) for SMS filtering.
     * Stored as comma-separated string, returned as list.
     */
    suspend fun getAirtelSenderNumbers(): List<String> {
        return dataStore.data.map { prefs ->
            prefs[KEY_AIRTEL_SENDER_NUMBERS]
                ?.split(",")
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?: emptyList()
        }.first()
    }

    /**
     * Returns Moov sender numbers (short codes) for SMS filtering.
     */
    suspend fun getMovSenderNumbers(): List<String> {
        return dataStore.data.map { prefs ->
            prefs[KEY_MOOV_SENDER_NUMBERS]
                ?.split(",")
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?: emptyList()
        }.first()
    }

    /**
     * Returns the USSD code template for Airtel Money.
     * Placeholder: will be set after Phase 0 field testing in Chad.
     */
    suspend fun getAirtelUssdCode(): String? {
        return dataStore.data.map { prefs ->
            prefs[KEY_AIRTEL_USSD_CODE]
        }.first()
    }

    /**
     * Returns the USSD code template for Moov Money.
     */
    suspend fun getMovUssdCode(): String? {
        return dataStore.data.map { prefs ->
            prefs[KEY_MOOV_USSD_CODE]
        }.first()
    }

    // ── Setters (for initial configuration or remote update) ──────────────

    suspend fun setBackendUrl(url: String) {
        dataStore.edit { it[KEY_BACKEND_URL] = url }
    }

    suspend fun setGatewayToken(token: String) {
        dataStore.edit { it[KEY_GATEWAY_TOKEN] = token }
    }

    suspend fun setAirtelSenderNumbers(numbers: List<String>) {
        dataStore.edit { it[KEY_AIRTEL_SENDER_NUMBERS] = numbers.joinToString(",") }
    }

    suspend fun setMoovSenderNumbers(numbers: List<String>) {
        dataStore.edit { it[KEY_MOOV_SENDER_NUMBERS] = numbers.joinToString(",") }
    }

    suspend fun setAirtelUssdCode(code: String) {
        dataStore.edit { it[KEY_AIRTEL_USSD_CODE] = code }
    }

    suspend fun setMoovUssdCode(code: String) {
        dataStore.edit { it[KEY_MOOV_USSD_CODE] = code }
    }
}
