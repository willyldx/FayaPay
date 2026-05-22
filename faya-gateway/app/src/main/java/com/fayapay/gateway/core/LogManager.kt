package com.fayapay.gateway.core

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Application-wide log manager that emits log entries as a SharedFlow.
 *
 * Used by:
 * - All subsystems to emit structured logs
 * - MainActivity to display logs in real-time via RecyclerView
 *
 * Also plants a custom Timber Tree that routes logs here,
 * so any Timber.i/d/w/e call automatically appears in the UI.
 *
 * This is a singleton because it must survive Activity recreation
 * and be accessible from components that don't have Koin injection
 * (like BroadcastReceivers).
 */
object LogManager {

    /**
     * Maximum number of log entries kept in memory.
     * Older entries are discarded when this limit is reached.
     */
    private const val MAX_ENTRIES = 500

    // L1 fix: DateTimeFormatter is thread-safe, unlike SimpleDateFormat
    private val timeFormat = java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")

    private val _logs = MutableSharedFlow<LogEntry>(
        replay = 0,                   // M6 fix: No replay — use logHistory for initial load
        extraBufferCapacity = 64
    )
    val logs: SharedFlow<LogEntry> = _logs.asSharedFlow()

    /**
     * In-memory list for initial population of RecyclerView.
     */
    private val _logHistory = ArrayDeque<LogEntry>(MAX_ENTRIES)
    val logHistory: List<LogEntry> get() = _logHistory.toList()

    fun log(level: LogLevel, message: String) {
        val entry = LogEntry(
            time = java.time.LocalTime.now().format(timeFormat),
            timestamp = System.currentTimeMillis(),
            level = level,
            message = message
        )

        synchronized(_logHistory) {
            _logHistory.addLast(entry)
            if (_logHistory.size > MAX_ENTRIES) {
                _logHistory.removeFirst()
            }
        }

        _logs.tryEmit(entry)
    }

    fun info(message: String) = log(LogLevel.INFO, message)
    fun warn(message: String) = log(LogLevel.WARN, message)
    fun error(message: String) = log(LogLevel.ERROR, message)
    fun debug(message: String) = log(LogLevel.DEBUG, message)

    /**
     * Timber Tree that routes to LogManager.
     * Plant this tree in FayaGatewayApp.onCreate().
     */
    class LogTree : timber.log.Tree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            val level = when (priority) {
                android.util.Log.VERBOSE, android.util.Log.DEBUG -> LogLevel.DEBUG
                android.util.Log.INFO -> LogLevel.INFO
                android.util.Log.WARN -> LogLevel.WARN
                android.util.Log.ERROR, android.util.Log.ASSERT -> LogLevel.ERROR
                else -> LogLevel.DEBUG
            }

            // Filter out noisy internal logs
            val tagStr = tag ?: ""
            if (tagStr.startsWith("OkHttp") || tagStr.startsWith("Koin")) return

            val displayMsg = if (t != null) "$message — ${t.message}" else message
            LogManager.log(level, displayMsg)
        }
    }
}

data class LogEntry(
    val time: String,
    val timestamp: Long,
    val level: LogLevel,
    val message: String
)

enum class LogLevel {
    DEBUG, INFO, WARN, ERROR
}
