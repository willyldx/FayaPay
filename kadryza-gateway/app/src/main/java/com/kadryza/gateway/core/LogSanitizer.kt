package com.kadryza.gateway.core

/**
 * Sanitizes sensitive data before logging.
 *
 * All log statements involving PII (phone numbers), financial data (amounts),
 * secrets (tokens), or message bodies (SMS) MUST use these methods.
 *
 * This exists because:
 * 1. Logcat is readable by any app with READ_LOGS
 * 2. LogManager stores 500 entries in memory (visible on UI)
 * 3. Crash reporters may capture recent logs
 * 4. The device could be physically accessed
 */
object LogSanitizer {

    /**
     * Masks a phone number, keeping only the first 4 digits.
     * "+23566123456" → "+235****"
     */
    fun phone(phone: String?): String {
        if (phone.isNullOrEmpty()) return "null"
        if (phone.length <= 4) return "***"
        return phone.take(4) + "*".repeat(phone.length - 4)
    }

    /**
     * Masks a monetary amount, showing only order of magnitude.
     * 5000 → "~5K", 150000 → "~150K"
     */
    fun amount(amount: Long?): String {
        if (amount == null) return "?"
        return when {
            amount < 1000 -> "~${amount}"
            amount < 1_000_000 -> "~${amount / 1000}K"
            else -> "~${amount / 1_000_000}M"
        }
    }

    /**
     * Masks an SMS body, showing only length.
     * "Vous avez recu 5000 FCFA de..." → "[SMS:42 chars]"
     */
    fun smsBody(body: String?): String {
        if (body.isNullOrEmpty()) return "[empty]"
        return "[SMS:${body.length} chars]"
    }

    /**
     * Masks a token/secret, showing only the last 4 characters.
     * "eyJhbGciOi...xyz123" → "***3456"
     */
    fun token(token: String?): String {
        if (token.isNullOrEmpty()) return "null"
        if (token.length <= 4) return "****"
        return "***${token.takeLast(4)}"
    }

    /**
     * Masks a transaction reference.
     * "ABC123XYZ" → "ABC***"
     */
    fun reference(ref: String?): String {
        if (ref.isNullOrEmpty()) return "null"
        if (ref.length <= 3) return "***"
        return ref.take(3) + "***"
    }

    /**
     * Masks a USSD code, showing only the command prefix.
     * "*880*1*+23566123456*5000#" → "*880*..."
     */
    fun ussdCode(code: String?): String {
        if (code.isNullOrEmpty()) return "null"
        val firstStar = code.indexOf('*', 1)
        return if (firstStar > 0) code.take(firstStar + 1) + "..." else "***"
    }
}
