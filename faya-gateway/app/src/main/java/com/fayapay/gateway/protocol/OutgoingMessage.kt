package com.fayapay.gateway.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Messages envoyés au backend via WebSocket.
 *
 * Discriminated by the "type" field in JSON.
 * Protocol reference: faya-backend-PRD.md §7
 */
@Serializable
sealed class OutgoingMessage {

    /**
     * Acknowledgement that an instruction was received and will be processed.
     * Sent immediately upon receiving INITIATE_PAYMENT, before any USSD work.
     */
    @Serializable
    @SerialName("ACK")
    data class Ack(
        @SerialName("transaction_id")
        val transactionId: String
    ) : OutgoingMessage()

    /**
     * USSD session has been successfully dialed on the device.
     * The gateway is now waiting for the operator's SMS confirmation.
     */
    @Serializable
    @SerialName("USSD_STARTED")
    data class UssdStarted(
        @SerialName("transaction_id")
        val transactionId: String
    ) : OutgoingMessage()

    /**
     * An SMS from the operator has been intercepted and parsed.
     * Contains both the raw SMS (for audit) and the parsed payload.
     */
    @Serializable
    @SerialName("SMS_RECEIVED")
    data class SmsReceived(
        @SerialName("transaction_id")
        val transactionId: String,
        @SerialName("sms_raw")
        val smsRaw: String,
        val parsed: ParsedSmsPayload
    ) : OutgoingMessage()

    /**
     * An operation has failed. The reason indicates what went wrong.
     *
     * Known reasons:
     * - USSD_TIMEOUT: USSD session did not complete within 30s
     * - SIM_NOT_AVAILABLE: required SIM not detected on this device
     * - PARSE_ERROR: SMS received but could not be parsed
     */
    @Serializable
    @SerialName("OPERATION_FAILED")
    data class OperationFailed(
        @SerialName("transaction_id")
        val transactionId: String,
        val reason: String
    ) : OutgoingMessage()

    /**
     * Heartbeat response. Sent every 30s and on-demand in response to PING.
     * Reports device identity and SIM availability.
     */
    @Serializable
    @SerialName("PONG")
    data class Pong(
        @SerialName("gateway_id")
        val gatewayId: String,
        @SerialName("sim_status")
        val simStatus: Map<String, String>  // {"AIRTEL": "ACTIVE", "MOOV": "ABSENT"}
    ) : OutgoingMessage()
}

/**
 * Parsed SMS payload embedded in [OutgoingMessage.SmsReceived].
 * Extracted by [com.fayapay.gateway.sms.SmsParser].
 */
@Serializable
data class ParsedSmsPayload(
    val amount: Long? = null,
    val sender: String? = null,
    val reference: String? = null,
    val success: Boolean
)
