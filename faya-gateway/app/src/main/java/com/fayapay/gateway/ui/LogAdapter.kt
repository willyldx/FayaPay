package com.fayapay.gateway.ui

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.fayapay.gateway.R
import com.fayapay.gateway.core.LogEntry
import com.fayapay.gateway.core.LogLevel

/**
 * RecyclerView adapter for real-time log display.
 *
 * Optimized for high-frequency updates:
 * - Uses notifyItemInserted instead of notifyDataSetChanged
 * - Caps the list at [MAX_VISIBLE] entries
 * - Auto-scrolls to bottom on new entries (handled by MainActivity)
 */
class LogAdapter : RecyclerView.Adapter<LogAdapter.LogViewHolder>() {

    companion object {
        private const val MAX_VISIBLE = 500

        // Log level colors
        private const val COLOR_DEBUG = "#666666"
        private const val COLOR_INFO = "#2EC4B6"   // Teal
        private const val COLOR_WARN = "#FFB347"   // Orange
        private const val COLOR_ERROR = "#CF6679"  // Red
    }

    private val entries = mutableListOf<LogEntry>()

    fun addEntry(entry: LogEntry) {
        entries.add(entry)
        if (entries.size > MAX_VISIBLE) {
            entries.removeAt(0)
            notifyItemRemoved(0)
        }
        notifyItemInserted(entries.size - 1)
    }

    fun setEntries(initial: List<LogEntry>) {
        entries.clear()
        entries.addAll(initial.takeLast(MAX_VISIBLE))
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LogViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_log, parent, false)
        return LogViewHolder(view)
    }

    override fun onBindViewHolder(holder: LogViewHolder, position: Int) {
        holder.bind(entries[position])
    }

    override fun getItemCount(): Int = entries.size

    class LogViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvTime: TextView = view.findViewById(R.id.tvLogTime)
        private val tvMessage: TextView = view.findViewById(R.id.tvLogMessage)

        fun bind(entry: LogEntry) {
            tvTime.text = entry.time

            val color = when (entry.level) {
                LogLevel.DEBUG -> COLOR_DEBUG
                LogLevel.INFO -> COLOR_INFO
                LogLevel.WARN -> COLOR_WARN
                LogLevel.ERROR -> COLOR_ERROR
            }

            val prefix = when (entry.level) {
                LogLevel.DEBUG -> ""
                LogLevel.INFO -> "✓ "
                LogLevel.WARN -> "⚠ "
                LogLevel.ERROR -> "✗ "
            }

            tvMessage.text = "$prefix${entry.message}"
            tvMessage.setTextColor(Color.parseColor(color))
        }
    }
}
