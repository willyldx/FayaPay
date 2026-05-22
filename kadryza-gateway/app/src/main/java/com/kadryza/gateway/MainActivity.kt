package com.kadryza.gateway

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.kadryza.gateway.core.GatewayManager
import com.kadryza.gateway.core.GatewayService
import com.kadryza.gateway.core.LogManager
import com.kadryza.gateway.databinding.ActivityMainBinding
import com.kadryza.gateway.sim.SimManager
import com.kadryza.gateway.ui.LogAdapter
import com.kadryza.gateway.ussd.UssdAccessibilityService
import com.kadryza.gateway.websocket.WebSocketClient
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import timber.log.Timber

/**
 * Minimal technical UI for the Kadryza Gateway device.
 *
 * Responsibilities:
 * 1. Request all runtime permissions at first launch
 * 2. Guide user to enable AccessibilityService
 * 3. Start/Stop GatewayService
 * 4. Display real-time connection status, SIM info, and logs
 *
 * PRD §8: "L'app n'a pas besoin d'une belle UI. C'est un outil technique."
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val gatewayManager: GatewayManager by inject()
    private val webSocketClient: WebSocketClient by inject()
    private val simManager: SimManager by inject()

    private lateinit var logAdapter: LogAdapter

    // ── Permission launcher ────────────────────────────────────────────────

    /**
     * Runtime permissions required for gateway operation.
     * POST_NOTIFICATIONS added for API 33+ foreground service notification.
     */
    private val requiredPermissions: Array<String> by lazy {
        buildList {
            add(Manifest.permission.RECEIVE_SMS)
            add(Manifest.permission.READ_SMS)
            add(Manifest.permission.CALL_PHONE)
            add(Manifest.permission.READ_PHONE_STATE)
            add(Manifest.permission.READ_PHONE_NUMBERS)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.toTypedArray()
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.all { it.value }
        if (allGranted) {
            Timber.i("MainActivity — All permissions granted")
            onPermissionsGranted()
        } else {
            val denied = results.filter { !it.value }.keys
            Timber.w("MainActivity — Permissions denied: $denied")
            showPermissionDeniedDialog(denied)
        }
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        setupLogs()
        checkPermissions()
    }

    override fun onResume() {
        super.onResume()
        refreshAccessibilityBanner()
        refreshSimStatus()
        refreshServiceButtonState()
        refreshConnectionStatus()
    }

    // ── UI Setup ───────────────────────────────────────────────────────────

    private fun setupUI() {
        // Version text
        binding.tvVersion.text = "v${BuildConfig.VERSION_NAME}"

        // Backend URL (extract host for display)
        lifecycleScope.launch {
            try {
                val deviceInfo = org.koin.java.KoinJavaComponent.getKoin()
                    .get<com.kadryza.gateway.core.DeviceInfo>()
                val url = deviceInfo.getBackendUrl()
                val host = Uri.parse(url.replace("wss://", "https://")).host ?: url
                binding.tvBackendUrl.text = host
            } catch (e: Exception) {
                binding.tvBackendUrl.text = "non configuré"
            }
        }

        // Start button
        binding.btnStart.setOnClickListener {
            startGatewayService()
        }

        // Stop button
        binding.btnStop.setOnClickListener {
            stopGatewayService()
        }

        // Accessibility settings button
        binding.btnOpenAccessibility.setOnClickListener {
            openAccessibilitySettings()
        }

        // Stats (placeholder — will be connected to real data later)
        binding.tvTransactionsToday.text = getString(R.string.transactions_today, 0)
        binding.tvLastTransaction.text = ""

        // Observe WebSocket connection state
        lifecycleScope.launch {
            webSocketClient.connectionState.collectLatest { state ->
                updateConnectionUI(state)
            }
        }
    }

    private fun setupLogs() {
        logAdapter = LogAdapter()

        binding.recyclerLogs.apply {
            layoutManager = LinearLayoutManager(this@MainActivity).apply {
                stackFromEnd = true  // New entries appear at bottom
            }
            adapter = logAdapter
            setHasFixedSize(false)
            isNestedScrollingEnabled = true
        }

        // Load existing log history
        logAdapter.setEntries(LogManager.logHistory)

        // Observe new log entries in real-time
        lifecycleScope.launch {
            LogManager.logs.collectLatest { entry ->
                logAdapter.addEntry(entry)
                // Auto-scroll to bottom
                if (logAdapter.itemCount > 0) {
                    binding.recyclerLogs.smoothScrollToPosition(logAdapter.itemCount - 1)
                }
            }
        }
    }

    // ── Permissions ────────────────────────────────────────────────────────

    private fun checkPermissions() {
        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isEmpty()) {
            Timber.d("MainActivity — All permissions already granted")
            onPermissionsGranted()
            return
        }

        // Check if we should show rationale for any permission
        val needsRationale = missingPermissions.any { shouldShowRequestPermissionRationale(it) }

        if (needsRationale) {
            showPermissionRationaleDialog(missingPermissions)
        } else {
            permissionLauncher.launch(missingPermissions.toTypedArray())
        }
    }

    private fun showPermissionRationaleDialog(permissions: List<String>) {
        val hasSms = permissions.any { it.contains("SMS") }
        val hasPhone = permissions.any { it.contains("PHONE") || it.contains("CALL") }

        val message = buildString {
            append("Kadryza Gateway a besoin des permissions suivantes :\n\n")
            if (hasSms) {
                append("📱 SMS — Intercepter les confirmations Mobile Money\n\n")
            }
            if (hasPhone) {
                append("📞 Téléphone — Exécuter les sessions USSD et détecter les SIMs\n\n")
            }
            append("Ces permissions sont indispensables au fonctionnement de la passerelle.")
        }

        AlertDialog.Builder(this)
            .setTitle("Permissions requises")
            .setMessage(message)
            .setPositiveButton("Accorder") { _, _ ->
                permissionLauncher.launch(permissions.toTypedArray())
            }
            .setNegativeButton("Annuler", null)
            .setCancelable(false)
            .show()
    }

    private fun showPermissionDeniedDialog(denied: Set<String>) {
        AlertDialog.Builder(this)
            .setTitle("Permissions manquantes")
            .setMessage(
                "Certaines permissions ont été refusées. " +
                "La passerelle ne pourra pas fonctionner correctement.\n\n" +
                "Vous pouvez les accorder dans les paramètres de l'application."
            )
            .setPositiveButton("Paramètres") { _, _ ->
                // Open app settings
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                }
                startActivity(intent)
            }
            .setNegativeButton("Ignorer", null)
            .show()
    }

    private fun onPermissionsGranted() {
        // Refresh SIM status now that we have READ_PHONE_STATE
        refreshSimStatus()
    }

    // ── Accessibility Service ──────────────────────────────────────────────

    private fun refreshAccessibilityBanner() {
        val isEnabled = UssdAccessibilityService.isAccessibilityEnabled(this)
        binding.bannerAccessibility.visibility = if (isEnabled) View.GONE else View.VISIBLE

        if (!isEnabled) {
            Timber.w("MainActivity — AccessibilityService not enabled")
        }
    }

    private fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
            Toast.makeText(
                this,
                "Activez « Kadryza Gateway » dans la liste des services",
                Toast.LENGTH_LONG
            ).show()
        } catch (e: Exception) {
            Timber.e(e, "MainActivity — Failed to open accessibility settings")
            Toast.makeText(this, "Impossible d'ouvrir les paramètres", Toast.LENGTH_SHORT).show()
        }
    }

    // ── Service Control ────────────────────────────────────────────────────

    private fun startGatewayService() {
        Timber.i("MainActivity — Starting GatewayService")

        val intent = Intent(this, GatewayService::class.java).apply {
            action = GatewayService.ACTION_START
        }
        startForegroundService(intent)

        binding.btnStart.isEnabled = false
        binding.btnStop.isEnabled = true
    }

    private fun stopGatewayService() {
        Timber.i("MainActivity — Stopping GatewayService")

        val intent = Intent(this, GatewayService::class.java).apply {
            action = GatewayService.ACTION_STOP
        }
        startService(intent)

        binding.btnStart.isEnabled = true
        binding.btnStop.isEnabled = false
    }

    private fun refreshServiceButtonState() {
        val isRunning = gatewayManager.isRunning()
        binding.btnStart.isEnabled = !isRunning
        binding.btnStop.isEnabled = isRunning
    }

    // ── Status Refresh ─────────────────────────────────────────────────────

    private fun refreshSimStatus() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            binding.tvSimAirtel.text = "⏳ Permission requise"
            binding.tvSimAirtel.setTextColor(getColor(R.color.design_default_color_error))
            binding.tvSimMoov.text = "⏳ Permission requise"
            binding.tvSimMoov.setTextColor(getColor(R.color.design_default_color_error))
            return
        }

        simManager.detectSims()
        val status = simManager.getSimStatusMap()

        // Airtel
        val airtelActive = status["AIRTEL"] == "ACTIVE"
        binding.tvSimAirtel.text = if (airtelActive) {
            getString(R.string.sim_active)
        } else {
            getString(R.string.sim_absent)
        }
        binding.tvSimAirtel.setTextColor(
            if (airtelActive) 0xFF2EC4B6.toInt() else 0xFFCF6679.toInt()
        )

        // Moov
        val moovActive = status["MOOV"] == "ACTIVE"
        binding.tvSimMoov.text = if (moovActive) {
            getString(R.string.sim_active)
        } else {
            getString(R.string.sim_absent)
        }
        binding.tvSimMoov.setTextColor(
            if (moovActive) 0xFF2EC4B6.toInt() else 0xFFCF6679.toInt()
        )
    }

    private fun refreshConnectionStatus() {
        updateConnectionUI(webSocketClient.connectionState.value)
    }

    private fun updateConnectionUI(state: WebSocketClient.ConnectionState) {
        runOnUiThread {
            when (state) {
                WebSocketClient.ConnectionState.CONNECTED -> {
                    binding.tvConnectionStatus.text = getString(R.string.status_connected)
                    binding.tvConnectionStatus.setTextColor(0xFF2EC4B6.toInt())
                }
                WebSocketClient.ConnectionState.CONNECTING -> {
                    binding.tvConnectionStatus.text = "● Connexion…"
                    binding.tvConnectionStatus.setTextColor(0xFFFFB347.toInt())
                }
                WebSocketClient.ConnectionState.RECONNECTING -> {
                    binding.tvConnectionStatus.text = "● Reconnexion…"
                    binding.tvConnectionStatus.setTextColor(0xFFFFB347.toInt())
                }
                WebSocketClient.ConnectionState.DISCONNECTED -> {
                    binding.tvConnectionStatus.text = getString(R.string.status_disconnected)
                    binding.tvConnectionStatus.setTextColor(0xFFCF6679.toInt())
                }
            }
        }
    }
}
