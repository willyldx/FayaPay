package com.kadryza.gateway.sms

import com.kadryza.gateway.core.DeviceInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import com.kadryza.gateway.core.LogSanitizer
import timber.log.Timber

/**
 * Filters incoming SMS to only process those from Mobile Money operators.
 *
 * The sender numbers (short codes) are loaded from DataStore via [DeviceInfo],
 * making them configurable without recompilation.
 *
 * PRD §5.4: "Filtrer uniquement les SMS venant des numéros opérateurs :
 * Airtel Money, Moov Money. Les numéros exacts seront configurés
 * après test terrain (Phase 0)"
 */
class SmsFilter(
    private val deviceInfo: DeviceInfo
) {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * Known operator sender numbers, loaded from DataStore.
     * Updated at startup and whenever config changes.
     */
    private var airtelSenders: Set<String> = emptySet()
    private var moovSenders: Set<String> = emptySet()

    /**
     * Callback invoked when a filtered (operator) SMS is received.
     * Set by GatewayManager during wiring.
     */
    var onOperatorSmsReceived: ((RawSms, OperatorOrigin) -> Unit)? = null

    private var filterJob: Job? = null

    /**
     * Loads sender numbers from DataStore and starts listening for SMS.
     */
    fun startFiltering() {
        filterJob?.cancel()
        filterJob = scope.launch {
            refreshSenderNumbers()

            SmsDispatcher.smsEvents
                .onEach { rawSms -> filterSms(rawSms) }
                .launchIn(this)

            Timber.i(
                "SmsFilter — Listening. Airtel senders=$airtelSenders, Moov senders=$moovSenders"
            )
        }
    }

    /**
     * Stops the SMS filter. Call during shutdown.
     */
    fun stop() {
        filterJob?.cancel()
        filterJob = null
        Timber.d("SmsFilter — Stopped")
    }

    /**
     * Reloads sender numbers from DataStore.
     * Call this after updating the config (e.g., from field testing results).
     */
    suspend fun refreshSenderNumbers() {
        airtelSenders = deviceInfo.getAirtelSenderNumbers().map { normalize(it) }.toSet()
        moovSenders = deviceInfo.getMovSenderNumbers().map { normalize(it) }.toSet()

        Timber.i("SmsFilter — Refreshed senders: airtel=$airtelSenders moov=$moovSenders")
    }

    /**
     * Determines whether an SMS is from an operator and dispatches accordingly.
     */
    private fun filterSms(rawSms: RawSms) {
        val normalizedSender = normalize(rawSms.sender)

        val origin = when {
            airtelSenders.isEmpty() && moovSenders.isEmpty() -> {
                // No sender numbers configured yet — log ALL SMS for Phase 0 field capture
                Timber.w(
                    "SmsFilter — No operator numbers configured! " +
                    "Logging SMS for field capture: sender=${rawSms.sender} body=${LogSanitizer.smsBody(rawSms.body)}"
                )
                // Still emit as UNKNOWN so it can be logged/forwarded
                OperatorOrigin.UNKNOWN
            }
            airtelSenders.contains(normalizedSender) -> {
                Timber.i("SmsFilter — Matched Airtel sender: ${rawSms.sender}")
                OperatorOrigin.AIRTEL
            }
            moovSenders.contains(normalizedSender) -> {
                Timber.i("SmsFilter — Matched Moov sender: ${rawSms.sender}")
                OperatorOrigin.MOOV
            }
            else -> {
                Timber.d("SmsFilter — Ignoring SMS from non-operator: ${rawSms.sender}")
                return  // Not an operator SMS — discard
            }
        }

        onOperatorSmsReceived?.invoke(rawSms, origin)
            ?: Timber.w("SmsFilter — No handler registered for operator SMS!")
    }

    /**
     * Normalizes a sender address for comparison.
     * Handles differences like spaces, dashes, and case.
     */
    private fun normalize(sender: String): String {
        return sender
            .trim()
            .uppercase()
            .replace(Regex("[\\s\\-()]"), "")
    }

    enum class OperatorOrigin {
        AIRTEL, MOOV, UNKNOWN
    }
}
