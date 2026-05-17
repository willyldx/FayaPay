package com.fayapay.gateway.heartbeat

import com.fayapay.gateway.core.DeviceInfo
import com.fayapay.gateway.protocol.OutgoingMessage
import com.fayapay.gateway.sim.SimManager
import com.fayapay.gateway.websocket.WebSocketClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * Sends periodic PONG heartbeats to faya-backend every 30 seconds.
 *
 * Also responds to on-demand PING requests from the backend
 * (triggered via [sendPongNow], called by [MessageHandler.onPingReceived]).
 *
 * The heartbeat payload includes:
 * - gateway_id: UUID of this device
 * - sim_status: availability of each operator's SIM
 *
 * PRD §5.9:
 * "Toutes les 30 secondes, envoyer message PONG au backend avec
 *  gateway_id, statut SIMs, timestamp"
 *
 * Note: The PRD mentions detecting dead connections if no backend response
 * in 60s. This is handled at the OkHttp level via pingInterval(30s) which
 * sends WebSocket-level pings (RFC 6455 §5.5.2). If the transport is dead,
 * OkHttp triggers onFailure → reconnection loop. The application-level
 * PONG is for business status reporting, not connection liveness.
 */
class HeartbeatManager(
    private val webSocketClient: WebSocketClient,
    private val deviceInfo: DeviceInfo
) {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var heartbeatJob: Job? = null

    /**
     * Injected after construction to break circular dependency.
     * SimManager is needed to report SIM status in the PONG payload.
     */
    var simManager: SimManager? = null

    /**
     * Starts the periodic heartbeat loop.
     * Idempotent — calling while already running cancels the old loop.
     */
    fun start() {
        stop()

        heartbeatJob = scope.launch {
            val intervalMs = deviceInfo.getHeartbeatIntervalMs()
            Timber.i("HeartbeatManager — Starting heartbeat loop (interval=${intervalMs}ms)")

            while (isActive) {
                delay(intervalMs)
                sendPongNow()
            }
        }
    }

    /**
     * Stops the periodic heartbeat loop.
     */
    fun stop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        Timber.d("HeartbeatManager — Stopped")
    }

    /**
     * Sends a PONG message immediately.
     * Called both by the periodic loop and on-demand when PING is received.
     */
    fun sendPongNow() {
        scope.launch {
            try {
                val gatewayId = deviceInfo.getGatewayId()
                val simStatus = simManager?.getSimStatusMap() ?: mapOf(
                    "AIRTEL" to "UNKNOWN",
                    "MOOV" to "UNKNOWN"
                )

                val pong = OutgoingMessage.Pong(
                    gatewayId = gatewayId,
                    simStatus = simStatus
                )

                val sent = webSocketClient.send(pong)
                if (sent) {
                    Timber.d("HeartbeatManager — PONG sent (sims=$simStatus)")
                } else {
                    Timber.w("HeartbeatManager — Failed to send PONG (not connected)")
                }
            } catch (e: Exception) {
                Timber.e(e, "HeartbeatManager — Error building PONG")
            }
        }
    }

    fun isRunning(): Boolean = heartbeatJob?.isActive == true
}
