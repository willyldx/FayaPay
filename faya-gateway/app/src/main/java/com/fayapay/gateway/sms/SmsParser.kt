package com.fayapay.gateway.sms

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.fayapay.gateway.core.LogSanitizer
import timber.log.Timber

/**
 * Parses operator SMS confirmation messages to extract transaction data.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  IMPORTANT: All regex patterns are PLACEHOLDERS.                   ║
 * ║  The real SMS formats from Airtel Money and Moov Money in Chad     ║
 * ║  must be captured during Phase 0 field testing.                    ║
 * ║                                                                    ║
 * ║  Architecture: patterns are loaded from DataStore and can be       ║
 * ║  updated at runtime via updatePatterns() without recompilation.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * PRD §5.5: "Prévoir une architecture flexible pour ajouter/modifier
 * les patterns sans recompiler l'app (via config DataStore ou fichier JSON)"
 */
class SmsParser {

    companion object {
        private val KEY_PATTERNS = stringPreferencesKey("sms_parser_patterns")

        /**
         * Default placeholder patterns — will be replaced after field testing.
         *
         * Named groups used:
         * - `amount`    → transaction amount in XAF
         * - `phone`     → sender phone number
         * - `reference` → operator transaction reference
         *
         * The regex is applied with IGNORE_CASE and DOT_MATCHES_ALL.
         */
        private val DEFAULT_PATTERNS = SmsPatternConfig(
            airtelPatterns = listOf(
                // Placeholder: "Vous avez recu 5000 FCFA de +23566XXXXXXX. Ref: ABC123"
                SmsPattern(
                    name = "airtel_receive_v1",
                    regex = """recu\s+(?<amount>\d+)\s*F?CFA\s+de\s+(?<phone>[\d+]+).*?[Rr]ef[:\s]+(?<reference>\w+)""",
                    successIndicator = "recu"
                ),
                // Placeholder variant: "Transfert de 5000 FCFA reussi. Ref: ABC123"
                SmsPattern(
                    name = "airtel_transfer_v1",
                    regex = """[Tt]ransfert\s+de\s+(?<amount>\d+)\s*F?CFA.*?reussi.*?[Rr]ef[:\s]+(?<reference>\w+)""",
                    successIndicator = "reussi"
                )
            ),
            moovPatterns = listOf(
                // Placeholder: "Transaction de 5000 F CFA recue de +23566XXXXXXX. ID: ABC123"
                SmsPattern(
                    name = "moov_receive_v1",
                    regex = """[Tt]ransaction\s+de\s+(?<amount>\d+)\s*F\s*CFA\s+recue\s+de\s+(?<phone>[\d+]+).*?ID[:\s]+(?<reference>\w+)""",
                    successIndicator = "recue"
                )
            )
        )
    }

    /**
     * Currently active patterns, loaded from DataStore or defaults.
     */
    private var currentConfig: SmsPatternConfig = DEFAULT_PATTERNS

    /**
     * Compiled regex cache — rebuilt when patterns change.
     */
    private var airtelRegexes: List<CompiledPattern> = compilePatterns(DEFAULT_PATTERNS.airtelPatterns)
    private var moovRegexes: List<CompiledPattern> = compilePatterns(DEFAULT_PATTERNS.moovPatterns)

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Parses an SMS body using the appropriate operator patterns.
     *
     * Tries each pattern in order, returning the first successful match.
     * If no pattern matches, returns a ParsedSms with success=false.
     *
     * @param body The raw SMS text
     * @param operator "AIRTEL", "MOOV", or "UNKNOWN"
     */
    fun parse(body: String, operator: String): ParsedSms {
        val patterns = when (operator.uppercase()) {
            "AIRTEL" -> airtelRegexes
            "MOOV" -> moovRegexes
            "UNKNOWN" -> airtelRegexes + moovRegexes  // Try all
            else -> {
                Timber.w("SmsParser — Unknown operator: $operator, trying all patterns")
                airtelRegexes + moovRegexes
            }
        }

        for (compiled in patterns) {
            val result = tryPattern(body, compiled, operator)
            if (result != null) {
                Timber.i(
                    "SmsParser — Matched pattern '${compiled.name}': " +
                    "amount=${LogSanitizer.amount(result.amount)} phone=${LogSanitizer.phone(result.senderPhone)} ref=${LogSanitizer.reference(result.reference)}"
                )
                return result
            }
        }

        Timber.w("SmsParser — No pattern matched for operator=$operator body=${LogSanitizer.smsBody(body)}")
        return ParsedSms(
            success = false,
            amount = null,
            senderPhone = null,
            reference = null,
            operator = operator,
            rawSms = body
        )
    }

    /**
     * Updates the parsing patterns at runtime.
     * Call this after Phase 0 field testing with the real SMS formats.
     *
     * Also persists the new patterns to DataStore so they survive app restarts.
     *
     * @param dataStore DataStore instance for persistence
     * @param config New pattern configuration
     */
    suspend fun updatePatterns(dataStore: DataStore<Preferences>, config: SmsPatternConfig) {
        currentConfig = config
        airtelRegexes = compilePatterns(config.airtelPatterns)
        moovRegexes = compilePatterns(config.moovPatterns)

        // Persist to DataStore
        val jsonStr = Json.encodeToString(config)
        dataStore.edit { prefs ->
            prefs[KEY_PATTERNS] = jsonStr
        }

        Timber.i(
            "SmsParser — Patterns updated: " +
            "${config.airtelPatterns.size} Airtel, ${config.moovPatterns.size} Moov"
        )
    }

    /**
     * Loads persisted patterns from DataStore.
     * Call at startup to restore patterns from last updatePatterns() call.
     * Falls back to defaults if nothing is stored.
     */
    suspend fun loadPatterns(dataStore: DataStore<Preferences>) {
        try {
            val jsonStr = dataStore.data.map { prefs -> prefs[KEY_PATTERNS] }.first()

            if (jsonStr != null) {
                val config = Json.decodeFromString<SmsPatternConfig>(jsonStr)
                currentConfig = config
                airtelRegexes = compilePatterns(config.airtelPatterns)
                moovRegexes = compilePatterns(config.moovPatterns)
                Timber.i("SmsParser — Loaded ${airtelRegexes.size + moovRegexes.size} patterns from DataStore")
            } else {
                Timber.i("SmsParser — No persisted patterns, using defaults")
            }
        } catch (e: Exception) {
            Timber.e(e, "SmsParser — Failed to load patterns from DataStore, using defaults")
        }
    }

    /**
     * Returns the current pattern configuration (for debugging/export).
     */
    fun getCurrentConfig(): SmsPatternConfig = currentConfig

    // ── Internal ───────────────────────────────────────────────────────────

    private fun tryPattern(body: String, compiled: CompiledPattern, operator: String): ParsedSms? {
        val match = compiled.regex.find(body) ?: return null

        // Check success indicator if defined
        val isSuccess = if (compiled.successIndicator != null) {
            body.contains(compiled.successIndicator, ignoreCase = true)
        } else {
            true  // No indicator = assume success if pattern matches
        }

        val amount = try {
            match.groups["amount"]?.value?.replace(Regex("[\\s.,]"), "")?.toLongOrNull()
        } catch (_: Exception) {
            null
        }

        val phone = try {
            match.groups["phone"]?.value?.trim()
        } catch (_: Exception) {
            null
        }

        val reference = try {
            match.groups["reference"]?.value?.trim()
        } catch (_: Exception) {
            null
        }

        return ParsedSms(
            success = isSuccess,
            amount = amount,
            senderPhone = phone,
            reference = reference,
            operator = operator,
            rawSms = body
        )
    }

    private fun compilePatterns(patterns: List<SmsPattern>): List<CompiledPattern> {
        return patterns.mapNotNull { pattern ->
            try {
                CompiledPattern(
                    name = pattern.name,
                    regex = Regex(
                        pattern.regex,
                        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
                    ),
                    successIndicator = pattern.successIndicator
                )
            } catch (e: Exception) {
                Timber.e(e, "SmsParser — Failed to compile pattern '${pattern.name}': ${pattern.regex}")
                null  // Skip invalid patterns instead of crashing
            }
        }
    }

    // ── Data structures ────────────────────────────────────────────────────

    private data class CompiledPattern(
        val name: String,
        val regex: Regex,
        val successIndicator: String?
    )
}

/**
 * Result of parsing an SMS.
 */
data class ParsedSms(
    val success: Boolean,
    val amount: Long?,
    val senderPhone: String?,
    val reference: String?,
    val operator: String,
    val rawSms: String
)

/**
 * Serializable pattern configuration — persisted in DataStore as JSON.
 * This is the structure you update after field testing in Chad.
 *
 * Example usage from ADB or a configuration endpoint:
 * ```json
 * {
 *   "airtelPatterns": [
 *     {
 *       "name": "airtel_real_v1",
 *       "regex": "...",
 *       "successIndicator": "..."
 *     }
 *   ],
 *   "moovPatterns": [...]
 * }
 * ```
 */
@Serializable
data class SmsPatternConfig(
    val airtelPatterns: List<SmsPattern>,
    val moovPatterns: List<SmsPattern>
)

@Serializable
data class SmsPattern(
    val name: String,
    val regex: String,
    val successIndicator: String? = null
)
