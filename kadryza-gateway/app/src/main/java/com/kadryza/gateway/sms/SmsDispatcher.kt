package com.kadryza.gateway.sms

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import timber.log.Timber

/**
 * Singleton bridge between [SmsReceiver] (BroadcastReceiver) and the
 * coroutine-based subsystems (SmsFilter, SmsParser, WebSocketClient).
 *
 * Why a singleton instead of Koin injection?
 * BroadcastReceivers declared in the Manifest are instantiated by Android,
 * not by Koin. They have a ~10-second lifecycle. We can't inject dependencies
 * into them. So [SmsReceiver] calls this static dispatcher, and the Koin-managed
 * [SmsFilter] subscribes to the flow.
 *
 * This is the only singleton in the codebase — everything else goes through Koin.
 */
object SmsDispatcher {

    /**
     * Raw SMS events emitted by [SmsReceiver].
     * Consumed by [SmsFilter] which decides whether to process the SMS.
     */
    private val _smsEvents = MutableSharedFlow<RawSms>(
        extraBufferCapacity = 256  // Must not drop financial SMS — large buffer
    )
    val smsEvents: SharedFlow<RawSms> = _smsEvents.asSharedFlow()

    /**
     * Called by [SmsReceiver] when an SMS arrives.
     * Non-blocking — uses tryEmit to avoid suspending in the BroadcastReceiver.
     */
    fun onSmsReceived(sender: String, body: String, subscriptionId: Int) {
        val rawSms = RawSms(
            sender = sender,
            body = body,
            subscriptionId = subscriptionId,
            receivedAt = System.currentTimeMillis()
        )

        val emitted = _smsEvents.tryEmit(rawSms)
        if (!emitted) {
            Timber.e("SmsDispatcher — Failed to emit SMS (buffer full): sender=$sender")
        }
    }
}

/**
 * Raw SMS data as received from Android.
 * No parsing has been done at this stage.
 */
data class RawSms(
    val sender: String,
    val body: String,
    val subscriptionId: Int,
    val receivedAt: Long
)
