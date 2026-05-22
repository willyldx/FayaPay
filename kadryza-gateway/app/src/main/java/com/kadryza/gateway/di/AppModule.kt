package com.kadryza.gateway.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import com.kadryza.gateway.core.DeviceInfo
import com.kadryza.gateway.core.GatewayManager
import com.kadryza.gateway.heartbeat.HeartbeatManager
import com.kadryza.gateway.sim.SimManager
import com.kadryza.gateway.sim.SimSelector
import com.kadryza.gateway.sms.SmsFilter
import com.kadryza.gateway.sms.SmsParser
import com.kadryza.gateway.ussd.UssdExecutor
import com.kadryza.gateway.ussd.UssdSessionManager
import com.kadryza.gateway.websocket.MessageHandler
import com.kadryza.gateway.websocket.WebSocketClient
import com.kadryza.gateway.websocket.WebSocketReconnector
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import java.util.concurrent.TimeUnit

/**
 * Top-level DataStore instance — must be a singleton at the process level.
 * Using extension property on Context as per official DataStore docs.
 */
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "gateway_config"
)

/**
 * Single Koin module for the entire app.
 *
 * Module structure rationale:
 * - `single` for long-lived singletons (OkHttpClient, DataStore, Json, managers)
 * - `factory` for stateless utilities that can be recreated (parsers, filters)
 *
 * Dependency graph:
 *
 *   DeviceInfo ─────→ WebSocketClient ──→ MessageHandler ──→ GatewayManager
 *       ↓                                      ↑                  ↑
 *   UssdExecutor ─→ UssdSessionManager ────────┘                  │
 *       ↓                                                         │
 *   SimSelector ──→ SimManager ───────────────────────────────────┘
 *                                                                 ↑
 *   SmsFilter ──→ SmsParser                                       │
 *       ↓                                                         │
 *   HeartbeatManager ─────────────────────────────────────────────┘
 *
 * Late injections (set in GatewayManager.start()):
 *   - HeartbeatManager.simManager ← SimManager
 *   - MessageHandler.onPingReceived ← HeartbeatManager
 *   - UssdExecutor.deviceInfo ← DeviceInfo
 *   - UssdSessionManager.ussdExecutor ← UssdExecutor
 */
val appModule = module {

    // ── Infrastructure ─────────────────────────────────────────────────────

    single {
        Json {
            ignoreUnknownKeys = true
            isLenient = false
            encodeDefaults = true
            classDiscriminator = "type"  // Matches the WS protocol "type" field
        }
    }

    single {
        OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)    // OkHttp-level WebSocket ping
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MINUTES)       // No read timeout for WS
            .writeTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    single<DataStore<Preferences>> {
        androidContext().dataStore
    }

    // ── Core ───────────────────────────────────────────────────────────────

    single { DeviceInfo(get()) }

    single { WebSocketReconnector() }

    single { WebSocketClient(get(), get(), get(), get()) }

    single { MessageHandler(get(), get(), get()) }

    single { HeartbeatManager(get(), get()) }

    single {
        GatewayManager(
            webSocketClient = get(),
            messageHandler = get(),
            heartbeatManager = get(),
            simManager = get(),
            ussdSessionManager = get(),
            ussdExecutor = get(),
            deviceInfo = get(),
            smsFilter = get(),
            smsParser = get(),
            dataStore = get()
        )
    }

    // ── SIM ────────────────────────────────────────────────────────────────

    single { SimManager(androidContext()) }

    single { SimSelector(get()) }

    // ── SMS ────────────────────────────────────────────────────────────────

    single { SmsParser() }

    single { SmsFilter(get()) }

    // ── USSD ───────────────────────────────────────────────────────────────

    single { UssdExecutor(androidContext(), get()) }

    single { UssdSessionManager() }
}
