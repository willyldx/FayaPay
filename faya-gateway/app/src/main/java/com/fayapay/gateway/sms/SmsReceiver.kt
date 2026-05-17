package com.fayapay.gateway.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import timber.log.Timber

/**
 * Static BroadcastReceiver for incoming SMS messages.
 *
 * Declared in AndroidManifest.xml (not registered dynamically) per PRD rule #3.
 * Priority 999 ensures we see the SMS before other apps.
 *
 * Flow:
 * 1. SMS arrives → Android dispatches to this receiver
 * 2. Extract sender + body from PDUs
 * 3. Pass to [SmsFilter] to check if it's from an operator
 * 4. If operator SMS → parse with [SmsParser]
 * 5. Forward parsed result to [SmsDispatcher] for WebSocket delivery
 *
 * PRD §5.4: "Écouter android.provider.Telephony.SMS_RECEIVED,
 * filtrer uniquement les SMS venant des numéros opérateurs"
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) {
            Timber.w("SmsReceiver — Received SMS intent but no messages extracted")
            return
        }

        // SMS can be split across multiple PDUs — reassemble
        val sender = messages[0].displayOriginatingAddress ?: "unknown"
        val body = messages.joinToString("") { it.displayMessageBody ?: "" }
        val subscriptionId = intent.getIntExtra("subscription", -1)

        Timber.i("SmsReceiver — SMS from=$sender subId=$subscriptionId length=${body.length}")
        Timber.d("SmsReceiver — Body: $body")

        // Delegate to the singleton dispatcher (accessed via Koin from Application)
        SmsDispatcher.onSmsReceived(
            sender = sender,
            body = body,
            subscriptionId = subscriptionId
        )
    }
}
