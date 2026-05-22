package com.fayapay.gateway.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import timber.log.Timber

/**
 * Starts [GatewayService] automatically when the device boots.
 *
 * Registered statically in AndroidManifest.xml for:
 * - android.intent.action.BOOT_COMPLETED (standard Android)
 * - android.intent.action.QUICKBOOT_POWERON (HTC/OEM fast boot)
 *
 * PRD §9: "Démarrer automatiquement GatewayService au boot du téléphone"
 *
 * Note: On Android 12+ (API 31), apps can still start foreground services
 * from BOOT_COMPLETED receivers. This is one of the exemptions listed in
 * the foreground service launch restrictions.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        Timber.i("BootReceiver — Device booted, starting GatewayService")

        val serviceIntent = Intent(context, GatewayService::class.java).apply {
            action = GatewayService.ACTION_START
        }

        // API 26+ requires startForegroundService for foreground services.
        // Since our minSdk is 26, no version check needed — but being explicit
        // for clarity and future-proofing.
        context.startForegroundService(serviceIntent)
    }
}
