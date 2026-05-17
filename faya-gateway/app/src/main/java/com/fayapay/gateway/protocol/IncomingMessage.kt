package com.fayapay.gateway.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Messages reçus du backend via WebSocket.
 *
 * Discriminated by the "type" field in JSON (configured via
 * [classDiscriminator = "type"] in the Json instance).
 *
 * Protocol reference: faya-backend-PRD.md §7
 *
 * Example payloads:
 * ```json
 * {"type":"INITIATE_PAYMENT","transaction_id":"uuid","amount":5000,"phone_number":"+23566...","operator":"AIRTEL"}
 * {"type":"PING"}
 * ```
 */
@Serializable
sealed class IncomingMessage {

    /**
     * Backend instructs this gateway to initiate a Mobile Money payment
     * via USSD on the appropriate SIM.
     *
     * Flow: receive → ACK → select SIM → dial USSD → USSD_STARTED
     */
    @Serializable
    @SerialName("INITIATE_PAYMENT")
    data class InitiatePayment(
        @SerialName("transaction_id")
        val transactionId: String,
        val amount: Long,
        @SerialName("phone_number")
        val phoneNumber: String,
        val operator: String   // "AIRTEL" or "MOOV"
    ) : IncomingMessage()

    /**
     * Backend requests an immediate heartbeat response (PONG).
     */
    @Serializable
    @SerialName("PING")
    data object Ping : IncomingMessage()
}
