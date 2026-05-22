package com.kadryza.gateway.ussd

import android.content.Context
import android.telephony.TelephonyManager
import com.kadryza.gateway.core.DeviceInfo
import com.kadryza.gateway.sim.SimManager
import com.kadryza.gateway.sim.SimSelector
import com.kadryza.gateway.core.LogSanitizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import timber.log.Timber
import kotlin.coroutines.resume

/**
 * Launches USSD sessions via TelephonyManager.sendUssdRequest()
 * or via Intent ACTION_CALL as fallback.
 *
 * USSD code templates are loaded from DataStore via [DeviceInfo],
 * making them configurable without recompilation.
 *
 * Template format uses placeholders:
 *   {phone}  → recipient phone number
 *   {amount} → amount in XAF
 *
 * Example: "*880*1*{phone}*{amount}#"
 *
 * PRD §5.6:
 * "Les codes USSD exacts d'Airtel et Moov Tchad doivent être
 *  documentés sur le terrain (Phase 0).
 *  Prévoir une configuration dynamique des codes USSD."
 */
class UssdExecutor(
    private val context: Context,
    private val simSelector: SimSelector
) {
    companion object {
        private const val USSD_TIMEOUT_MS = 30_000L
    }

    /**
     * Reference to DeviceInfo, injected post-construction to avoid
     * circular dependency in Koin graph.
     */
    var deviceInfo: DeviceInfo? = null

    /**
     * Dials a USSD code for a payment transaction.
     *
     * @param amount Amount in XAF
     * @param phoneNumber Recipient phone number
     * @param operator "AIRTEL" or "MOOV"
     * @return [UssdResult] indicating success or failure
     */
    suspend fun executeUssd(
        amount: Long,
        phoneNumber: String,
        operator: String
    ): UssdResult {
        // 1. Get the USSD code template from DataStore
        val template = getUssdTemplate(operator)
        if (template == null) {
            Timber.e("UssdExecutor — No USSD template configured for operator=$operator")
            return UssdResult.Failed("USSD_NOT_CONFIGURED")
        }

        // 2. Build the USSD string from template
        val ussdCode = buildUssdCode(template, phoneNumber, amount)
        Timber.i("UssdExecutor — USSD code built for operator=$operator")

        // 3. Get the correct SIM subscription ID
        val subscriptionId = try {
            simSelector.getSubscriptionId(operator)
        } catch (e: SimSelector.SimNotAvailableException) {
            Timber.e(e, "UssdExecutor — SIM not available for $operator")
            return UssdResult.Failed("SIM_NOT_AVAILABLE")
        }

        // 4. Execute the USSD request
        return try {
            dialUssd(ussdCode, subscriptionId)
        } catch (e: SecurityException) {
            Timber.e(e, "UssdExecutor — Permission denied for USSD dial")
            UssdResult.Failed("PERMISSION_DENIED")
        } catch (e: Exception) {
            Timber.e(e, "UssdExecutor — Unexpected error during USSD dial")
            UssdResult.Failed("USSD_ERROR")
        }
    }

    // ── Internal ───────────────────────────────────────────────────────────

    private suspend fun getUssdTemplate(operator: String): String? {
        val info = deviceInfo ?: run {
            Timber.e("UssdExecutor — DeviceInfo not injected")
            return null
        }

        return when (operator.uppercase()) {
            "AIRTEL" -> info.getAirtelUssdCode()
            "MOOV" -> info.getMovUssdCode()
            else -> {
                Timber.e("UssdExecutor — Unknown operator: $operator")
                null
            }
        }
    }

    /**
     * Replaces placeholders in the USSD template.
     * Template: "*880*1*{phone}*{amount}#"
     * Result:   "*880*1*+23566000000*5000#"
     */
    private fun buildUssdCode(template: String, phoneNumber: String, amount: Long): String {
        return template
            .replace("{phone}", phoneNumber)
            .replace("{amount}", amount.toString())
    }

    /**
     * Executes the USSD request via TelephonyManager.sendUssdRequest().
     *
     * This API (added in API 26) sends a USSD request on a specific subscription
     * and receives the response via callback. However, for multi-step USSD menus,
     * the AccessibilityService is still needed to interact with the system dialogs.
     *
     * For simple one-shot USSD codes (like direct transfer), this API may
     * receive the final response directly.
     */
    private suspend fun dialUssd(
        ussdCode: String,
        subscriptionId: Int
    ): UssdResult = withContext(Dispatchers.Main) {
        // TelephonyManager per subscription
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE)
            as TelephonyManager
        val subTelephonyManager = telephonyManager.createForSubscriptionId(subscriptionId)

        Timber.i("UssdExecutor — Dialing USSD: $ussdCode on subId=$subscriptionId")

        try {
            withTimeout(USSD_TIMEOUT_MS) {
                suspendCancellableCoroutine { continuation ->
                    subTelephonyManager.sendUssdRequest(
                        ussdCode,
                        object : TelephonyManager.UssdResponseCallback() {
                            override fun onReceiveUssdResponse(
                                telephonyManager: TelephonyManager,
                                request: String,
                                response: CharSequence
                            ) {
                                Timber.i("UssdExecutor — USSD response: $response")
                                if (continuation.isActive) {
                                    continuation.resume(
                                        UssdResult.ResponseReceived(response.toString())
                                    )
                                }
                            }

                            override fun onReceiveUssdResponseFailed(
                                telephonyManager: TelephonyManager,
                                request: String,
                                failureCode: Int
                            ) {
                                Timber.e(
                                    "UssdExecutor — USSD failed: code=$failureCode request=$request"
                                )
                                if (continuation.isActive) {
                                    continuation.resume(
                                        UssdResult.Failed("USSD_FAILED_CODE_$failureCode")
                                    )
                                }
                            }
                        },
                        null  // Handler — null uses main looper
                    )
                }
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            Timber.e("UssdExecutor — USSD timeout after ${USSD_TIMEOUT_MS}ms")
            UssdResult.Failed("USSD_TIMEOUT")
        }
    }

    /**
     * Result of a USSD execution attempt.
     */
    sealed class UssdResult {
        /**
         * USSD response received. For multi-step menus, this is the first response.
         * The AccessibilityService handles subsequent menu navigation.
         */
        data class ResponseReceived(val response: String) : UssdResult()

        /**
         * USSD execution failed.
         */
        data class Failed(val reason: String) : UssdResult()
    }
}
