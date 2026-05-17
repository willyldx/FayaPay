package com.fayapay.gateway.sim

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import timber.log.Timber

/**
 * Detects and tracks available SIM cards on the device.
 *
 * Identifies operator SIMs by matching carrier names against known patterns.
 * Handles gracefully:
 * - Missing READ_PHONE_STATE permission
 * - No SIM inserted
 * - Unrecognized carrier names
 * - Single SIM devices
 *
 * PRD §5.8: "Détecter les SIMs présentes (SubscriptionManager),
 * identifier l'opérateur de chaque SIM (carrier name)"
 */
class SimManager(private val context: Context) {

    enum class OperatorType { AIRTEL, MOOV, UNKNOWN }

    /**
     * Carrier name patterns for operator identification.
     * Case-insensitive matching. Add more patterns as discovered in the field.
     *
     * These cover known Chadian carrier name variations reported by different
     * Android devices and firmware versions.
     */
    companion object {
        private val AIRTEL_PATTERNS = listOf(
            "airtel", "airtel td", "airtel tchad", "airtel chad",
            "celtel", "zain"  // Historical names of Airtel in Chad
        )

        private val MOOV_PATTERNS = listOf(
            "moov", "moov africa", "moov td", "moov tchad", "moov chad",
            "atlantique", "etisalat"  // Historical/alternative names
        )
    }

    /**
     * Map of detected operator → SIM subscription.
     * Empty until [detectSims] is called.
     */
    private var detectedSims: Map<OperatorType, SubscriptionInfo> = emptyMap()

    /**
     * All active subscriptions regardless of operator identification.
     */
    private var allSubscriptions: List<SubscriptionInfo> = emptyList()

    /**
     * Scans for active SIMs and identifies their operators.
     *
     * Safe to call repeatedly — refreshes the detection.
     * Does NOT throw on missing permission — returns empty and logs a warning.
     */
    fun detectSims() {
        // Check permission before accessing SubscriptionManager
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Timber.w("SimManager — READ_PHONE_STATE permission not granted, cannot detect SIMs")
            detectedSims = emptyMap()
            allSubscriptions = emptyList()
            return
        }

        val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE)
            as? SubscriptionManager

        if (subscriptionManager == null) {
            Timber.e("SimManager — SubscriptionManager unavailable")
            detectedSims = emptyMap()
            allSubscriptions = emptyList()
            return
        }

        try {
            val activeSubscriptions = subscriptionManager.activeSubscriptionInfoList ?: emptyList()
            allSubscriptions = activeSubscriptions

            Timber.i("SimManager — Found ${activeSubscriptions.size} active SIM(s)")

            val identified = mutableMapOf<OperatorType, SubscriptionInfo>()

            for (sub in activeSubscriptions) {
                val carrierName = sub.carrierName?.toString() ?: ""
                val displayName = sub.displayName?.toString() ?: ""
                val slotIndex = sub.simSlotIndex

                Timber.d(
                    "SimManager — SIM slot=$slotIndex carrier='$carrierName' " +
                    "display='$displayName' subId=${sub.subscriptionId}"
                )

                val operatorType = identifyOperator(carrierName, displayName)

                if (operatorType != OperatorType.UNKNOWN) {
                    // If we already found this operator, keep the first one
                    if (!identified.containsKey(operatorType)) {
                        identified[operatorType] = sub
                        Timber.i("SimManager — Identified $operatorType on slot $slotIndex")
                    } else {
                        Timber.w(
                            "SimManager — Duplicate $operatorType SIM on slot $slotIndex, " +
                            "keeping first one (slot ${identified[operatorType]!!.simSlotIndex})"
                        )
                    }
                } else {
                    Timber.w(
                        "SimManager — Unrecognized carrier '$carrierName' on slot $slotIndex. " +
                        "Not mapped to any operator. Add carrier pattern if this is Airtel or Moov."
                    )
                }
            }

            detectedSims = identified

            Timber.i("SimManager — Detection complete: ${getSimStatusMap()}")

        } catch (e: SecurityException) {
            Timber.e(e, "SimManager — SecurityException during SIM detection")
            detectedSims = emptyMap()
            allSubscriptions = emptyList()
        } catch (e: Exception) {
            Timber.e(e, "SimManager — Unexpected error during SIM detection")
            detectedSims = emptyMap()
            allSubscriptions = emptyList()
        }
    }

    /**
     * Returns the SubscriptionInfo for a given operator, or null if absent.
     */
    fun getSubscriptionForOperator(operator: OperatorType): SubscriptionInfo? {
        return detectedSims[operator]
    }

    /**
     * Returns SIM status map for PONG heartbeats.
     * Format: {"AIRTEL": "ACTIVE", "MOOV": "ABSENT"}
     */
    fun getSimStatusMap(): Map<String, String> {
        return mapOf(
            "AIRTEL" to if (detectedSims.containsKey(OperatorType.AIRTEL)) "ACTIVE" else "ABSENT",
            "MOOV" to if (detectedSims.containsKey(OperatorType.MOOV)) "ACTIVE" else "ABSENT"
        )
    }

    /**
     * Checks if a specific operator's SIM is available.
     */
    fun isOperatorAvailable(operator: OperatorType): Boolean {
        return detectedSims.containsKey(operator)
    }

    /**
     * Returns the total number of active SIMs (regardless of identification).
     */
    fun getActiveSimCount(): Int = allSubscriptions.size

    // ── Internal ───────────────────────────────────────────────────────────

    /**
     * Identifies the operator from carrier and display names.
     * Case-insensitive substring matching against known patterns.
     */
    private fun identifyOperator(carrierName: String, displayName: String): OperatorType {
        val lowerCarrier = carrierName.lowercase()
        val lowerDisplay = displayName.lowercase()

        for (pattern in AIRTEL_PATTERNS) {
            if (lowerCarrier.contains(pattern) || lowerDisplay.contains(pattern)) {
                return OperatorType.AIRTEL
            }
        }

        for (pattern in MOOV_PATTERNS) {
            if (lowerCarrier.contains(pattern) || lowerDisplay.contains(pattern)) {
                return OperatorType.MOOV
            }
        }

        return OperatorType.UNKNOWN
    }
}
