package com.fayapay.gateway.ussd

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import timber.log.Timber

/**
 * Accessibility Service for interacting with USSD system dialogs.
 *
 * Android displays USSD responses in AlertDialogs created by the Phone app
 * (com.android.phone). These dialogs cannot be read or interacted with
 * by normal apps — only an AccessibilityService can:
 *
 * 1. Detect when a USSD dialog appears
 * 2. Read the response text
 * 3. Click buttons (OK, Cancel, Send)
 * 4. Enter input for multi-step menus
 *
 * CRITICAL: This service must be manually enabled by the user in
 * Settings > Accessibility > FayaPay Gateway.
 * MainActivity should guide the user to enable it if not active.
 *
 * PRD §5.7: "Service d'accessibilité pour naviguer les popups USSD système"
 *
 * Configuration: see res/xml/accessibility_service_config.xml
 * - Scoped to com.android.phone package only
 * - Listens for window state changes and content changes
 */
class UssdAccessibilityService : AccessibilityService() {

    companion object {
        /**
         * Static flag indicating whether this service is currently active.
         * Used by MainActivity to check if the user has enabled it.
         */
        @Volatile
        var isServiceActive: Boolean = false
            private set

        /**
         * Callback for USSD dialog text, set by [UssdSessionManager].
         */
        @Volatile
        var onUssdDialogDetected: ((ussdText: String) -> Unit)? = null

        /**
         * Whether to auto-confirm USSD dialogs by clicking "OK" / "Send".
         * Default true — the gateway should proceed without human intervention.
         */
        var autoConfirm: Boolean = true

        /**
         * Checks if the accessibility service is enabled in system settings.
         * Used by MainActivity to prompt the user.
         */
        fun isAccessibilityEnabled(context: android.content.Context): Boolean {
            val am = context.getSystemService(android.content.Context.ACCESSIBILITY_SERVICE)
                as android.view.accessibility.AccessibilityManager
            val enabledServices = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false

            return enabledServices.contains(
                "${context.packageName}/${UssdAccessibilityService::class.java.canonicalName}"
            )
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceActive = true
        Timber.i("UssdAccessibilityService — Service connected and active")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                handleWindowStateChange(event)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                handleContentChange(event)
            }
            else -> {
                // Ignore other event types
            }
        }
    }

    override fun onInterrupt() {
        Timber.w("UssdAccessibilityService — Service interrupted")
    }

    override fun onDestroy() {
        isServiceActive = false
        Timber.w("UssdAccessibilityService — Service destroyed")
        super.onDestroy()
    }

    // ── Event handling ─────────────────────────────────────────────────────

    /**
     * Called when a new window appears (e.g., USSD dialog popup).
     */
    private fun handleWindowStateChange(event: AccessibilityEvent) {
        val className = event.className?.toString() ?: return
        val packageName = event.packageName?.toString() ?: return

        Timber.d("UssdAccessibilityService — Window: class=$className pkg=$packageName")

        // USSD dialogs are typically AlertDialogs from the Phone app
        if (!isUssdDialog(className, packageName)) {
            return
        }

        Timber.i("UssdAccessibilityService — USSD dialog detected!")

        // Extract text from the dialog
        val dialogText = extractDialogText(event)
        if (dialogText.isNotBlank()) {
            Timber.i("UssdAccessibilityService — USSD text: $dialogText")
            onUssdDialogDetected?.invoke(dialogText)
        }

        // Auto-confirm if enabled
        if (autoConfirm) {
            clickConfirmButton()
        }
    }

    /**
     * Called when dialog content changes (e.g., USSD response updates).
     */
    private fun handleContentChange(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return

        // Only process events from the Phone app
        if (!packageName.contains("phone", ignoreCase = true) &&
            !packageName.contains("dialer", ignoreCase = true)
        ) {
            return
        }

        val text = extractDialogText(event)
        if (text.isNotBlank()) {
            Timber.d("UssdAccessibilityService — Content updated: $text")
            onUssdDialogDetected?.invoke(text)
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Determines if the event is from a USSD dialog.
     * Different OEMs use different class names for USSD dialogs.
     */
    private fun isUssdDialog(className: String, packageName: String): Boolean {
        val isPhonePackage = packageName.contains("phone", ignoreCase = true) ||
            packageName.contains("dialer", ignoreCase = true) ||
            packageName == "com.android.phone"

        val isDialog = className.contains("AlertDialog", ignoreCase = true) ||
            className.contains("UssdDialog", ignoreCase = true) ||
            className.contains("Dialog", ignoreCase = true)

        return isPhonePackage && isDialog
    }

    /**
     * Extracts all text content from the accessibility event and its source node.
     */
    private fun extractDialogText(event: AccessibilityEvent): String {
        val textParts = mutableListOf<String>()

        // Text from the event itself
        event.text?.forEach { cs ->
            val str = cs?.toString()?.trim()
            if (!str.isNullOrBlank()) {
                textParts.add(str)
            }
        }

        // Text from the source node tree (deeper extraction)
        try {
            val source = event.source
            if (source != null) {
                extractNodeText(source, textParts)
                source.recycle()
            }
        } catch (e: Exception) {
            Timber.e(e, "UssdAccessibilityService — Error extracting node text")
        }

        return textParts.joinToString(" ").trim()
    }

    /**
     * Recursively extracts text from an AccessibilityNodeInfo tree.
     */
    private fun extractNodeText(node: AccessibilityNodeInfo, results: MutableList<String>) {
        val nodeText = node.text?.toString()?.trim()
        if (!nodeText.isNullOrBlank() && nodeText !in results) {
            results.add(nodeText)
        }

        val contentDesc = node.contentDescription?.toString()?.trim()
        if (!contentDesc.isNullOrBlank() && contentDesc !in results) {
            results.add(contentDesc)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            extractNodeText(child, results)
            child.recycle()
        }
    }

    /**
     * Clicks the confirm/OK/Send button in the USSD dialog.
     * Tries multiple button labels for OEM compatibility.
     */
    private fun clickConfirmButton() {
        val rootNode = rootInActiveWindow ?: return

        try {
            val confirmLabels = listOf(
                "OK", "Ok", "ok",
                "Send", "Envoyer", "ENVOYER",
                "Confirm", "Confirmer", "CONFIRMER",
                "Yes", "Oui", "OUI"
            )

            for (label in confirmLabels) {
                val nodes = rootNode.findAccessibilityNodeInfosByText(label)
                for (node in nodes) {
                    if (node.isClickable) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        Timber.i("UssdAccessibilityService — Clicked '$label' button")
                        node.recycle()
                        rootNode.recycle()
                        return
                    }
                    // If the node itself isn't clickable, try its parent
                    val parent = node.parent
                    if (parent?.isClickable == true) {
                        parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        Timber.i("UssdAccessibilityService — Clicked parent of '$label' button")
                        parent.recycle()
                        node.recycle()
                        rootNode.recycle()
                        return
                    }
                    parent?.recycle()
                    node.recycle()
                }
            }

            Timber.w("UssdAccessibilityService — No confirm button found")
        } catch (e: Exception) {
            Timber.e(e, "UssdAccessibilityService — Error clicking confirm button")
        } finally {
            try {
                rootNode.recycle()
            } catch (_: Exception) {
            }
        }
    }
}
