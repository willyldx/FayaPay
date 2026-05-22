package com.kadryza.gateway

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.kadryza.gateway.di.appModule
import com.kadryza.gateway.core.LogManager
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.core.logger.Level
import timber.log.Timber

/**
 * Application class — single entry point for global initialization.
 *
 * Responsibilities:
 * 1. Plant Timber logging tree (debug builds only — release uses no-op)
 * 2. Start Koin dependency injection graph
 * 3. Create the foreground service notification channel (required API 26+)
 */
class KadryzaGatewayApp : Application() {

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "kadryza_gateway_service"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()

        // ── Timber ─────────────────────────────────────────────────────────
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            // In production: plant a crash-reporting tree or no-op.
            // For now, still plant DebugTree so field testing on
            // the Chadian device can produce logcat output.
            Timber.plant(Timber.DebugTree())
        }

        // Plant LogTree to route Timber logs to the UI
        Timber.plant(LogManager.LogTree())

        Timber.i("KadryzaGatewayApp — initializing")

        // ── Notification Channel ───────────────────────────────────────────
        createNotificationChannel()

        // ── Koin DI ────────────────────────────────────────────────────────
        startKoin {
            androidLogger(if (BuildConfig.DEBUG) Level.DEBUG else Level.NONE)
            androidContext(this@KadryzaGatewayApp)
            modules(appModule)
        }

        Timber.i("KadryzaGatewayApp — ready")
    }

    /**
     * Creates the notification channel for the foreground service.
     * This is idempotent — calling it multiple times is safe.
     * Required on API 26+ (our minSdk), so no version check needed.
     */
    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW  // Low = no sound, just persistent icon
        ).apply {
            description = getString(R.string.notification_channel_description)
            setShowBadge(false)
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)

        Timber.d("Notification channel created: $NOTIFICATION_CHANNEL_ID")
    }
}
