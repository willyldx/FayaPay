package com.fayapay.gateway.websocket

import com.fayapay.gateway.core.DeviceInfo
import com.fayapay.gateway.protocol.IncomingMessage
import com.fayapay.gateway.protocol.OutgoingMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import timber.log.Timber

/**
 * OkHttp WebSocket client managing the persistent connection to faya-backend.
 *
 * Architecture:
 * - OkHttp WebSocket callbacks arrive on OkHttp's internal threads
 * - All callbacks are immediately bridged to coroutine flows/channels
 * - Consumers (MessageHandler, HeartbeatManager) observe flows from coroutine context
 * - Outgoing messages are sent via [send], which is thread-safe (OkHttp guarantees this)
 *
 * PRD §5.2: "Thread-safe : utiliser des coroutines, pas de callbacks raw"
 */
class WebSocketClient(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
    private val deviceInfo: DeviceInfo,
    private val reconnector: WebSocketReconnector
) {
    /**
     * Connection state observable by UI and other components.
     */
    enum class ConnectionState {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        RECONNECTING
    }

    // ── State ──────────────────────────────────────────────────────────────

    private var webSocket: WebSocket? = null

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _incomingMessages = MutableSharedFlow<IncomingMessage>(
        extraBufferCapacity = 64  // Buffer messages if consumer is slow
    )
    val incomingMessages: SharedFlow<IncomingMessage> = _incomingMessages.asSharedFlow()

    /**
     * Channel for connection lifecycle events consumed by the reconnection loop.
     * Using Channel (not Flow) because each event must be consumed exactly once.
     */
    private val disconnectEvents = Channel<DisconnectReason>(Channel.BUFFERED)

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var reconnectJob: Job? = null

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Initiates the WebSocket connection and starts the reconnection loop.
     * Idempotent — calling while already connected is a no-op.
     */
    suspend fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTED ||
            _connectionState.value == ConnectionState.CONNECTING
        ) {
            Timber.d("WebSocketClient — Already connected/connecting, skipping")
            return
        }

        startReconnectionLoop()
        performConnect()
    }

    /**
     * Cleanly disconnects and stops the reconnection loop.
     */
    fun disconnect() {
        Timber.i("WebSocketClient — Disconnecting (explicit)")
        reconnectJob?.cancel()
        reconnectJob = null
        reconnector.cancelReconnection()
        webSocket?.close(CLOSE_NORMAL, "Client shutting down")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    /**
     * Sends an [OutgoingMessage] to the backend.
     * Returns true if the message was enqueued, false if not connected.
     *
     * Thread-safe: OkHttp's WebSocket.send() is internally synchronized.
     */
    fun send(message: OutgoingMessage): Boolean {
        val ws = webSocket
        if (ws == null) {
            Timber.w("WebSocketClient — Cannot send, not connected: $message")
            return false
        }

        return try {
            val payload = json.encodeToString(message)
            val sent = ws.send(payload)
            if (sent) {
                Timber.d("WebSocketClient — Sent: $payload")
            } else {
                Timber.w("WebSocketClient — Send failed (queue full): $payload")
            }
            sent
        } catch (e: Exception) {
            Timber.e(e, "WebSocketClient — Error serializing outgoing message")
            false
        }
    }

    fun isConnected(): Boolean = _connectionState.value == ConnectionState.CONNECTED

    // ── Connection logic ───────────────────────────────────────────────────

    private suspend fun performConnect() {
        _connectionState.value = ConnectionState.CONNECTING

        val backendUrl = deviceInfo.getBackendUrl()
        val token = deviceInfo.getGatewayToken()
        val gatewayId = deviceInfo.getGatewayId()

        if (token.isNullOrBlank()) {
            Timber.e("WebSocketClient — No gateway token configured. Cannot connect.")
            _connectionState.value = ConnectionState.DISCONNECTED
            return
        }

        val request = Request.Builder()
            .url(backendUrl)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("X-Gateway-Id", gatewayId)
            .build()

        Timber.i("WebSocketClient — Connecting to $backendUrl (gateway=$gatewayId)")

        webSocket = okHttpClient.newWebSocket(request, createListener())
    }

    private fun createListener() = object : WebSocketListener() {

        override fun onOpen(webSocket: WebSocket, response: Response) {
            Timber.i("WebSocketClient — Connected (HTTP ${response.code})")
            _connectionState.value = ConnectionState.CONNECTED
            reconnector.onConnectionSuccess()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Timber.d("WebSocketClient — Received: $text")
            try {
                val message = json.decodeFromString<IncomingMessage>(text)
                // Emit to flow — non-blocking, will buffer if consumers are slow
                val emitted = _incomingMessages.tryEmit(message)
                if (!emitted) {
                    Timber.w("WebSocketClient — Message buffer full, dropped: $text")
                }
            } catch (e: Exception) {
                Timber.e(e, "WebSocketClient — Failed to parse incoming message: $text")
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Timber.i("WebSocketClient — Server closing: code=$code reason=$reason")
            webSocket.close(CLOSE_NORMAL, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Timber.w("WebSocketClient — Closed: code=$code reason=$reason")
            this@WebSocketClient.webSocket = null
            _connectionState.value = ConnectionState.DISCONNECTED
            disconnectEvents.trySend(DisconnectReason.Closed(code, reason))
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Timber.e(t, "WebSocketClient — Connection failed (HTTP ${response?.code})")
            this@WebSocketClient.webSocket = null
            _connectionState.value = ConnectionState.DISCONNECTED
            disconnectEvents.trySend(DisconnectReason.Failure(t))
        }
    }

    // ── Reconnection loop ──────────────────────────────────────────────────

    /**
     * Launches a coroutine that listens for disconnect events and
     * triggers reconnection with exponential backoff.
     *
     * The loop runs for the lifetime of the connection (until [disconnect] is called).
     */
    private fun startReconnectionLoop() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            for (event in disconnectEvents) {
                Timber.i("WebSocketClient — Disconnect event received: $event")

                if (!reconnector.markReconnecting()) {
                    Timber.d("WebSocketClient — Reconnection already in progress")
                    continue
                }

                _connectionState.value = ConnectionState.RECONNECTING

                while (reconnector.isReconnecting()) {
                    val attempt = reconnector.awaitNextAttempt()
                    Timber.i("WebSocketClient — Reconnection attempt #$attempt")

                    try {
                        performConnect()

                        // Wait briefly for the connection to establish.
                        // If onOpen fires, reconnector.onConnectionSuccess() will
                        // clear the reconnecting flag and break this loop.
                        kotlinx.coroutines.delay(3_000)

                        if (_connectionState.value == ConnectionState.CONNECTED) {
                            Timber.i("WebSocketClient — Reconnection successful on attempt #$attempt")
                            break
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "WebSocketClient — Reconnection attempt #$attempt failed")
                    }
                }
            }
        }
    }

    // ── Constants ──────────────────────────────────────────────────────────

    companion object {
        /** Normal closure (RFC 6455 §7.4.1) */
        private const val CLOSE_NORMAL = 1000
    }

    /**
     * Sealed class representing why the WebSocket disconnected.
     * Consumed by the reconnection loop to decide whether to retry.
     */
    private sealed class DisconnectReason {
        data class Closed(val code: Int, val reason: String) : DisconnectReason()
        data class Failure(val throwable: Throwable) : DisconnectReason()
    }
}
