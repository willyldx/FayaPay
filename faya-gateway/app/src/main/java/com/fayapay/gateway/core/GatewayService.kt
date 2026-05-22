package com.fayapay.gateway.core

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.fayapay.gateway.FayaGatewayApp
import com.fayapay.gateway.MainActivity
import com.fayapay.gateway.R
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.koin.android.ext.android.inject
import timber.log.Timber

/**
 * The heart of faya-gateway. This foreground service runs indefinitely
 * on the dedicated Android device, maintaining the WebSocket connection
 * to faya-backend and orchestrating USSD/SMS operations.
 *
 * Lifecycle:
 * - Started by [BootReceiver] at device boot or by [MainActivity] manually
 * - Displays a persistent notification with connection status
 * - Returns START_STICKY so Android restarts it if killed
 * - Holds a partial wake lock to survive Doze mode
 * - Only stops on explicit user action (ACTION_STOP)
 *
 * PRD §5.1: "Ne jamais s'arrêter sauf ordre explicite de l'utilisateur"
 */
class GatewayService : Service() {

    companion object {
        const val ACTION_START = "com.fayapay.gateway.ACTION_START"
        const val ACTION_STOP = "com.fayapay.gateway.ACTION_STOP"
        const val ACTION_UPDATE_NOTIFICATION = "com.fayapay.gateway.ACTION_UPDATE_NOTIFICATION"

        const val EXTRA_NOTIFICATION_TEXT = "notification_text"

        private const val WAKE_LOCK_TAG = "FayaGateway::ServiceWakeLock"
    }

    private val gatewayManager: GatewayManager by inject()

    private var wakeLock: PowerManager.WakeLock? = null

    /**
     * Service-scoped coroutine scope.
     * Uses SupervisorJob so a failure in one child doesn't cancel siblings.
     * The exception handler ensures we never crash silently (PRD rule #8).
     */
    private val serviceScope = CoroutineScope(
        Dispatchers.Default + SupervisorJob() + CoroutineExceptionHandler { _, throwable ->
            Timber.e(throwable, "GatewayService — Uncaught exception in service scope")
        }
    )

    // ── Lifecycle ──────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Timber.i("GatewayService — onCreate")
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Timber.i("GatewayService — onStartCommand action=${intent?.action}")

        when (intent?.action) {
            ACTION_STOP -> {
                Timber.i("GatewayService — Explicit stop requested")
                stopGateway()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_UPDATE_NOTIFICATION -> {
                val text = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT)
                    ?: getString(R.string.notification_text_connected, "")
                updateNotification(text)
                return START_STICKY
            }

            else -> {
                // ACTION_START or null (system restart after kill)
                // H5 fix: Ensure wake lock is held after system restart
                acquireWakeLock()
                startForegroundWithNotification()
                startGateway()
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        Timber.w("GatewayService — onDestroy (should only happen on explicit stop)")
        stopGateway()
        releaseWakeLock()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null  // Not a bound service

    // ── Foreground notification ────────────────────────────────────────────

    /**
     * Starts this service in foreground with a persistent notification.
     * Must be called within 5 seconds of startForegroundService() or Android
     * will throw a ForegroundServiceDidNotStartInTimeException.
     */
    private fun startForegroundWithNotification() {
        val notification = buildNotification(
            getString(R.string.notification_text_disconnected)
        )

        startForeground(
            FayaGatewayApp.NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )

        Timber.d("GatewayService — Foreground notification displayed")
    }

    private fun buildNotification(contentText: String): Notification {
        // Tapping the notification opens MainActivity
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val tapPendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop action in notification
        val stopIntent = Intent(this, GatewayService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, FayaGatewayApp.NOTIFICATION_CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_notify_sync)  // TODO: Replace with custom icon
            .setOngoing(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(tapPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                getString(R.string.btn_stop_service),
                stopPendingIntent
            )
            .build()
    }

    /**
     * Updates the notification text without restarting the service.
     * Called by GatewayManager when connection status changes.
     */
    fun updateNotification(text: String) {
        val notification = buildNotification(text)
        val manager = getSystemService(android.app.NotificationManager::class.java)
        manager.notify(FayaGatewayApp.NOTIFICATION_ID, notification)
    }

    // ── Gateway orchestration ──────────────────────────────────────────────

    private fun startGateway() {
        serviceScope.launch {
            try {
                Timber.i("GatewayService — Starting gateway manager")
                gatewayManager.start()
            } catch (e: Exception) {
                Timber.e(e, "GatewayService — Failed to start gateway manager")
                updateNotification("Erreur: ${e.message}")
            }
        }
    }

    private fun stopGateway() {
        // Must run synchronously — service is about to be destroyed.
        // Using runBlocking is intentional here: we need GatewayManager.stop()
        // to complete BEFORE serviceScope.cancel() in onDestroy().
        runBlocking(Dispatchers.Default) {
            try {
                gatewayManager.stop()
                Timber.i("GatewayService — Gateway manager stopped")
            } catch (e: Exception) {
                Timber.e(e, "GatewayService — Error stopping gateway manager")
            }
        }
    }

    // ── Wake lock ──────────────────────────────────────────────────────────

    /**
     * Acquires a partial wake lock to keep the CPU running even when
     * the screen is off. This is critical for a gateway device that must
     * process SMS/USSD 24/7.
     *
     * The wake lock is partial (not full) — screen can turn off, but CPU
     * stays awake. This balances reliability with battery preservation.
     */
    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            WAKE_LOCK_TAG
        ).apply {
            setReferenceCounted(false)
            acquire()  // Indefinite — released in onDestroy
        }
        Timber.d("GatewayService — Wake lock acquired")
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Timber.d("GatewayService — Wake lock released")
            }
        }
        wakeLock = null
    }
}
