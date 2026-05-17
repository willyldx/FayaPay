package com.fayapay.gateway.websocket

import com.fayapay.gateway.protocol.IncomingMessage
import com.fayapay.gateway.protocol.OutgoingMessage
import com.fayapay.gateway.ussd.UssdSessionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.serialization.json.Json
import timber.log.Timber

/**
 * Routes incoming WebSocket messages to the appropriate subsystem.
 *
 * Decouples the WebSocket transport layer from business logic:
 * - INITIATE_PAYMENT → UssdSessionManager (execute USSD, wait for SMS)
 * - PING → immediate PONG response via HeartbeatManager
 *
 * This class consumes [WebSocketClient.incomingMessages] and dispatches.
 * It does NOT own the coroutine scope — it uses its own SupervisorJob
 * so that a failure in one handler doesn't block future messages.
 *
 * PRD §5.2: "Recevoir les messages JSON et les router vers MessageHandler"
 */
class MessageHandler(
    private val webSocketClient: WebSocketClient,
    private val json: Json,
    private val ussdSessionManager: UssdSessionManager
) {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * Callback invoked when a PING is received.
     * Set by [HeartbeatManager] to send a PONG without circular dependency.
     */
    var onPingReceived: (() -> Unit)? = null

    /**
     * Starts consuming messages from the WebSocket.
     * Call once after WebSocketClient is ready.
     *
     * Uses [launchIn] to create a collection coroutine that survives
     * individual message processing failures.
     */
    fun startListening() {
        Timber.i("MessageHandler — Listening for incoming messages")

        webSocketClient.incomingMessages
            .onEach { message -> handleMessage(message) }
            .launchIn(scope)
    }

    // ── Routing ────────────────────────────────────────────────────────────

    private suspend fun handleMessage(message: IncomingMessage) {
        when (message) {
            is IncomingMessage.InitiatePayment -> handleInitiatePayment(message)
            is IncomingMessage.Ping -> handlePing()
        }
    }

    /**
     * Handles INITIATE_PAYMENT:
     * 1. Immediately send ACK to backend (transaction received)
     * 2. Delegate USSD execution to UssdSessionManager
     *
     * The ACK is sent BEFORE any USSD work begins, so the backend knows
     * the instruction was received even if USSD takes 30s to complete.
     */
    private suspend fun handleInitiatePayment(message: IncomingMessage.InitiatePayment) {
        Timber.i(
            "MessageHandler — INITIATE_PAYMENT received: " +
            "tx=${message.transactionId} amount=${message.amount} " +
            "operator=${message.operator} phone=${message.phoneNumber}"
        )

        // Step 1: ACK immediately
        val ack = OutgoingMessage.Ack(transactionId = message.transactionId)
        val sent = webSocketClient.send(ack)
        if (!sent) {
            Timber.e("MessageHandler — Failed to send ACK for tx=${message.transactionId}")
            // Don't return — still attempt the USSD even if ACK failed.
            // The backend has its own timeout mechanism.
        }

        // Step 2: Execute the payment via USSD
        try {
            ussdSessionManager.executePayment(
                transactionId = message.transactionId,
                amount = message.amount,
                phoneNumber = message.phoneNumber,
                operator = message.operator,
                onUssdStarted = {
                    webSocketClient.send(
                        OutgoingMessage.UssdStarted(transactionId = message.transactionId)
                    )
                },
                onFailed = { reason ->
                    webSocketClient.send(
                        OutgoingMessage.OperationFailed(
                            transactionId = message.transactionId,
                            reason = reason
                        )
                    )
                }
            )
        } catch (e: Exception) {
            Timber.e(e, "MessageHandler — Unhandled error processing tx=${message.transactionId}")
            webSocketClient.send(
                OutgoingMessage.OperationFailed(
                    transactionId = message.transactionId,
                    reason = "INTERNAL_ERROR"
                )
            )
        }
    }

    /**
     * Handles PING: delegates to HeartbeatManager via callback.
     */
    private fun handlePing() {
        Timber.d("MessageHandler — PING received, triggering PONG")
        onPingReceived?.invoke()
            ?: Timber.w("MessageHandler — No onPingReceived handler registered")
    }
}
