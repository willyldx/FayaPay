package com.fayapay.gateway.core

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.fayapay.gateway.heartbeat.HeartbeatManager
import com.fayapay.gateway.protocol.OutgoingMessage
import com.fayapay.gateway.protocol.ParsedSmsPayload
import com.fayapay.gateway.sim.SimManager
import com.fayapay.gateway.sms.SmsFilter
import com.fayapay.gateway.sms.SmsParser
import com.fayapay.gateway.sms.RawSms
import com.fayapay.gateway.ussd.SmsConfirmation
import com.fayapay.gateway.ussd.UssdExecutor
import com.fayapay.gateway.ussd.UssdSessionManager
import com.fayapay.gateway.websocket.MessageHandler
import com.fayapay.gateway.websocket.WebSocketClient
import timber.log.Timber
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Central orchestrator — coordinates all gateway subsystems.
 *
 * Responsible for:
 * 1. Startup sequencing (SIM → config → WebSocket → listeners → heartbeat)
 * 2. Late dependency injection (breaking circular references)
 * 3. SMS → transaction correlation pipeline
 * 4. Shutdown cleanup
 *
 * This class does NOT run on its own thread — it's driven by
 * [GatewayService]'s coroutine scope.
 */
class GatewayManager(
    private val webSocketClient: WebSocketClient,
    private val messageHandler: MessageHandler,
    private val heartbeatManager: HeartbeatManager,
    private val simManager: SimManager,
    private val ussdSessionManager: UssdSessionManager,
    private val ussdExecutor: UssdExecutor,
    private val deviceInfo: DeviceInfo,
    private val smsFilter: SmsFilter,
    private val smsParser: SmsParser,
    private val dataStore: DataStore<Preferences>
) {
    private val isStarted = AtomicBoolean(false)

    /**
     * Starts all subsystems in the correct order.
     * Idempotent — duplicate calls are ignored.
     */
    suspend fun start() {
        if (!isStarted.compareAndSet(false, true)) {
            Timber.w("GatewayManager — Already running, ignoring duplicate start")
            return
        }

        Timber.i("GatewayManager — Starting subsystems")

        // 1. Detect SIMs
        try {
            simManager.detectSims()
            Timber.i("GatewayManager — SIMs detected: ${simManager.getSimStatusMap()}")
        } catch (e: SecurityException) {
            Timber.e(e, "GatewayManager — SIM detection failed (missing permission)")
        }

        // 2. Load SMS parser patterns from DataStore
        try {
            smsParser.loadPatterns(dataStore)
            Timber.i("GatewayManager — SMS parser patterns loaded")
        } catch (e: Exception) {
            Timber.e(e, "GatewayManager — Failed to load SMS parser patterns")
        }

        // 3. Wire late injections (break circular dependencies)
        heartbeatManager.simManager = simManager
        messageHandler.onPingReceived = { heartbeatManager.sendPongNow() }
        ussdExecutor.deviceInfo = deviceInfo
        ussdSessionManager.ussdExecutor = ussdExecutor

        // 4. Wire SMS pipeline: SmsFilter → SmsParser → WebSocket
        smsFilter.onOperatorSmsReceived = { rawSms, origin ->
            handleOperatorSms(rawSms, origin)
        }

        // 5. Connect WebSocket
        webSocketClient.connect()

        // 6. Start message listener (consumes WebSocket incoming flow)
        messageHandler.startListening()

        // 7. Start SMS filtering (consumes SmsDispatcher flow)
        smsFilter.startFiltering()

        // 8. Start heartbeat loop
        heartbeatManager.start()

        Timber.i("GatewayManager — All subsystems started")
    }

    /**
     * Stops all subsystems in reverse order.
     */
    suspend fun stop() {
        if (!isStarted.compareAndSet(true, false)) {
            Timber.w("GatewayManager — Not running, ignoring stop")
            return
        }

        Timber.i("GatewayManager — Stopping subsystems")

        heartbeatManager.stop()
        ussdSessionManager.cancelAll()
        webSocketClient.disconnect()

        Timber.i("GatewayManager — All subsystems stopped")
    }

    fun isRunning(): Boolean = isStarted.get()

    // ── SMS Pipeline ───────────────────────────────────────────────────────

    /**
     * Handles an SMS that has been identified as coming from an operator.
     *
     * Flow:
     * 1. Parse the SMS using SmsParser
     * 2. Check if any pending transaction matches
     * 3. If match → send SMS_RECEIVED to backend
     * 4. If no match → log for debugging (orphaned SMS)
     */
    private fun handleOperatorSms(rawSms: RawSms, origin: SmsFilter.OperatorOrigin) {
        val operatorStr = when (origin) {
            SmsFilter.OperatorOrigin.AIRTEL -> "AIRTEL"
            SmsFilter.OperatorOrigin.MOOV -> "MOOV"
            SmsFilter.OperatorOrigin.UNKNOWN -> "UNKNOWN"
        }

        Timber.i("GatewayManager — Operator SMS received: operator=$operatorStr sender=${rawSms.sender}")

        // Parse the SMS
        val parsed = smsParser.parse(rawSms.body, operatorStr)

        Timber.i(
            "GatewayManager — Parsed SMS: success=${parsed.success} " +
            "amount=${parsed.amount} phone=${parsed.senderPhone} ref=${parsed.reference}"
        )

        // Try to match with a pending transaction
        val pendingTxIds = ussdSessionManager.getPendingTransactionIds()

        if (pendingTxIds.isEmpty()) {
            Timber.w(
                "GatewayManager — Operator SMS received but no pending transactions. " +
                "Orphaned SMS: $rawSms"
            )
            return
        }

        // For now, match the first pending transaction.
        // In production with concurrent transactions, we would correlate by
        // phone number or reference. Since the PRD implies single-gateway
        // serial processing, this is sufficient.
        val matchedTxId = pendingTxIds.first()

        Timber.i("GatewayManager — Matching SMS to tx=$matchedTxId")

        // Notify UssdSessionManager
        val confirmation = SmsConfirmation(
            transactionId = matchedTxId,
            amount = parsed.amount,
            senderPhone = parsed.senderPhone,
            reference = parsed.reference,
            success = parsed.success,
            rawSms = parsed.rawSms
        )
        ussdSessionManager.onSmsConfirmation(matchedTxId, confirmation)

        // Send SMS_RECEIVED to backend
        val outgoing = OutgoingMessage.SmsReceived(
            transactionId = matchedTxId,
            smsRaw = rawSms.body,
            parsed = ParsedSmsPayload(
                amount = parsed.amount,
                sender = parsed.senderPhone,
                reference = parsed.reference,
                success = parsed.success
            )
        )
        webSocketClient.send(outgoing)

        Timber.i("GatewayManager — SMS_RECEIVED sent to backend for tx=$matchedTxId")
    }
}
