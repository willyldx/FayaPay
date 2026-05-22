package com.fayapay.gateway.ussd

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import timber.log.Timber
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages USSD session state and orchestrates the full payment execution flow.
 *
 * Coordinates between:
 * - [UssdExecutor] → dials the USSD code
 * - [UssdAccessibilityService] → reads USSD dialog responses
 * - SMS pipeline → waits for operator confirmation SMS
 *
 * Ensures only one USSD session runs at a time (USSD is inherently serial
 * on a single SIM — you can't have two concurrent USSD sessions).
 *
 * PRD §5.6: "Timeout: si pas de réponse AccessibilityService en 30s → FAILED"
 */
class UssdSessionManager {

    companion object {
        const val USSD_TIMEOUT_MS = 30_000L
        /** Auto-cleanup pending SMS after 2 minutes if no SMS arrives */
        const val SMS_CONFIRMATION_TIMEOUT_MS = 120_000L
    }

    private val sessionMutex = Mutex()
    private val pendingSmsConfirmations = ConcurrentHashMap<String, CompletableDeferred<SmsConfirmation>>()
    private val cleanupScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * Callback invoked when a pending SMS times out.
     * Set by GatewayManager to send OPERATION_FAILED to the backend.
     */
    var onSmsTimeout: ((transactionId: String) -> Unit)? = null

    /**
     * Reference to UssdExecutor, injected post-construction.
     */
    var ussdExecutor: UssdExecutor? = null

    /**
     * Executes a Mobile Money payment via USSD.
     *
     * This is a suspend function that:
     * 1. Acquires the session mutex (queues if another session is active)
     * 2. Dials the USSD code
     * 3. Reports USSD_STARTED via callback
     * 4. Registers for SMS confirmation
     * 5. Returns — SMS confirmation is handled asynchronously via [onSmsConfirmation]
     *
     * @param transactionId Backend transaction ID for correlation
     * @param amount Amount in XAF (integer)
     * @param phoneNumber Recipient phone number
     * @param operator "AIRTEL" or "MOOV"
     * @param onUssdStarted Called when the USSD session is successfully initiated
     * @param onFailed Called if the operation fails, with the reason string
     */
    suspend fun executePayment(
        transactionId: String,
        amount: Long,
        phoneNumber: String,
        operator: String,
        onUssdStarted: () -> Unit,
        onFailed: (reason: String) -> Unit
    ) {
        val executor = ussdExecutor
        if (executor == null) {
            Timber.e("UssdSessionManager — UssdExecutor not injected")
            onFailed("INTERNAL_ERROR")
            return
        }

        // Acquire the session lock — only one USSD at a time
        Timber.i("UssdSessionManager — Acquiring session lock for tx=$transactionId")
        sessionMutex.withLock {
            Timber.i("UssdSessionManager — Session lock acquired for tx=$transactionId")

            try {
                // Set up AccessibilityService callback for this session
                val ussdResponseDeferred = CompletableDeferred<String>()
                UssdAccessibilityService.onUssdDialogDetected = { text ->
                    if (ussdResponseDeferred.isActive) {
                        ussdResponseDeferred.complete(text)
                    }
                }

                // Execute the USSD
                val result = executor.executeUssd(
                    amount = amount,
                    phoneNumber = phoneNumber,
                    operator = operator
                )

                when (result) {
                    is UssdExecutor.UssdResult.ResponseReceived -> {
                        Timber.i(
                            "UssdSessionManager — USSD response received for tx=$transactionId: " +
                            result.response
                        )
                        onUssdStarted()

                        // Register this transaction as waiting for SMS confirmation
                        registerPendingSmsConfirmation(transactionId)

                        Timber.i(
                            "UssdSessionManager — tx=$transactionId now waiting for SMS confirmation"
                        )
                    }

                    is UssdExecutor.UssdResult.Failed -> {
                        Timber.e(
                            "UssdSessionManager — USSD failed for tx=$transactionId: ${result.reason}"
                        )
                        onFailed(result.reason)
                    }
                }
            } catch (e: Exception) {
                Timber.e(e, "UssdSessionManager — Unhandled error for tx=$transactionId")
                onFailed("INTERNAL_ERROR")
            } finally {
                // Clean up the accessibility callback
                UssdAccessibilityService.onUssdDialogDetected = null
            }
        }

        Timber.d("UssdSessionManager — Session lock released for tx=$transactionId")
    }

    /**
     * Registers a transaction as waiting for SMS confirmation.
     * Called after successful USSD dial.
     */
    private fun registerPendingSmsConfirmation(transactionId: String) {
        val deferred = CompletableDeferred<SmsConfirmation>()
        pendingSmsConfirmations[transactionId] = deferred
        Timber.d("UssdSessionManager — Registered pending SMS for tx=$transactionId")

        // Auto-cleanup after timeout to prevent memory leaks
        cleanupScope.launch {
            delay(SMS_CONFIRMATION_TIMEOUT_MS)
            if (pendingSmsConfirmations.remove(transactionId) != null) {
                deferred.cancel()
                Timber.e(
                    "UssdSessionManager — SMS confirmation TIMEOUT for tx=$transactionId " +
                    "(no SMS received within ${SMS_CONFIRMATION_TIMEOUT_MS / 1000}s)"
                )
                onSmsTimeout?.invoke(transactionId)
            }
        }
    }

    /**
     * Called by the SMS pipeline when a confirmation SMS is received
     * and parsed. Completes the pending deferred if a matching transaction
     * is waiting.
     *
     * @param transactionId The transaction this SMS belongs to
     * @param confirmation The parsed SMS data
     * @return true if a pending transaction was matched
     */
    fun onSmsConfirmation(transactionId: String, confirmation: SmsConfirmation): Boolean {
        val deferred = pendingSmsConfirmations.remove(transactionId)
        if (deferred != null) {
            deferred.complete(confirmation)
            Timber.i("UssdSessionManager — SMS confirmation matched tx=$transactionId")
            return true
        }

        Timber.w("UssdSessionManager — No pending transaction for SMS confirmation tx=$transactionId")
        return false
    }

    /**
     * Checks if any transaction is waiting for SMS confirmation.
     */
    fun hasPendingConfirmations(): Boolean = pendingSmsConfirmations.isNotEmpty()

    /**
     * Returns the set of transaction IDs currently waiting for SMS.
     */
    fun getPendingTransactionIds(): Set<String> = pendingSmsConfirmations.keys.toSet()

    /**
     * Cancels a pending SMS confirmation (e.g., on timeout or explicit cancel).
     */
    fun cancelPendingConfirmation(transactionId: String) {
        val deferred = pendingSmsConfirmations.remove(transactionId)
        if (deferred != null) {
            deferred.cancel()
            Timber.i("UssdSessionManager — Cancelled pending SMS for tx=$transactionId")
        }
    }

    /**
     * Cancels all pending confirmations (e.g., on service shutdown).
     */
    fun cancelAll() {
        pendingSmsConfirmations.forEach { (txId, deferred) ->
            deferred.cancel()
            Timber.d("UssdSessionManager — Cancelled pending tx=$txId")
        }
        pendingSmsConfirmations.clear()
    }
}

/**
 * Data class representing a parsed SMS confirmation.
 */
data class SmsConfirmation(
    val transactionId: String,
    val amount: Long?,
    val senderPhone: String?,
    val reference: String?,
    val success: Boolean,
    val rawSms: String
)
