package com.fayapay.gateway.websocket

import timber.log.Timber
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Exponential backoff reconnection strategy for the WebSocket connection.
 *
 * Sequence (PRD §5.3):
 *   Attempt 1 → 2s
 *   Attempt 2 → 4s
 *   Attempt 3 → 8s
 *   Attempt 4+ → 30s (capped)
 *
 * The counter resets to 0 on successful connection.
 *
 * Thread-safe: uses AtomicInteger for the attempt counter.
 */
class WebSocketReconnector {

    companion object {
        private const val BASE_DELAY_MS = 2_000L
        private const val MAX_DELAY_MS = 30_000L
        private const val MULTIPLIER = 2.0
    }

    private val attemptCount = AtomicInteger(0)
    private val isReconnecting = AtomicBoolean(false)

    /**
     * Computes the next delay and suspends for that duration.
     * Returns the attempt number (1-indexed) after the delay completes.
     *
     * This is a suspend function — it uses coroutine delay, not Thread.sleep.
     */
    suspend fun awaitNextAttempt(): Int {
        val attempt = attemptCount.incrementAndGet()
        val delayMs = computeDelay(attempt)

        Timber.i("WebSocketReconnector — Attempt #$attempt, waiting ${delayMs}ms before reconnect")
        delay(delayMs)

        return attempt
    }

    /**
     * Resets the attempt counter. Call this when a connection succeeds.
     */
    fun onConnectionSuccess() {
        val previousAttempts = attemptCount.getAndSet(0)
        isReconnecting.set(false)
        if (previousAttempts > 0) {
            Timber.i("WebSocketReconnector — Connection restored after $previousAttempts attempts, counter reset")
        }
    }

    /**
     * Marks reconnection as in progress.
     */
    fun markReconnecting(): Boolean = isReconnecting.compareAndSet(false, true)

    /**
     * Clears the reconnecting flag without resetting attempts.
     * Used when reconnection is cancelled (e.g., service stop).
     */
    fun cancelReconnection() {
        isReconnecting.set(false)
        Timber.d("WebSocketReconnector — Reconnection cancelled")
    }

    fun isReconnecting(): Boolean = isReconnecting.get()

    fun getCurrentAttempt(): Int = attemptCount.get()

    /**
     * Computes delay with exponential backoff capped at [MAX_DELAY_MS].
     *
     * attempt 1 → 2^0 * 2000 = 2000ms
     * attempt 2 → 2^1 * 2000 = 4000ms
     * attempt 3 → 2^2 * 2000 = 8000ms
     * attempt 4 → capped at 30000ms
     */
    private fun computeDelay(attempt: Int): Long {
        if (attempt <= 0) return BASE_DELAY_MS

        val exponentialDelay = BASE_DELAY_MS * Math.pow(MULTIPLIER, (attempt - 1).toDouble()).toLong()
        return exponentialDelay.coerceAtMost(MAX_DELAY_MS)
    }
}
