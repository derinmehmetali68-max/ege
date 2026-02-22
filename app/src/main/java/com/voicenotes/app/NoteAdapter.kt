package com.voicenotes.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class NoteAdapter(
    private val onNoteClick: (Note) -> Unit,
    private val onPlayClick: (Note) -> Unit,
    private val onSpeakClick: (Note) -> Unit,
    private val onDeleteClick: (Note) -> Unit
) : ListAdapter<Note, NoteAdapter.NoteViewHolder>(NoteDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NoteViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_note, parent, false)
        return NoteViewHolder(view)
    }

    override fun onBindViewHolder(holder: NoteViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class NoteViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val noteTitle: TextView = itemView.findViewById(R.id.noteTitle)
        private val noteContent: TextView = itemView.findViewById(R.id.noteContent)
        private val noteDate: TextView = itemView.findViewById(R.id.noteDate)
        private val noteDuration: TextView = itemView.findViewById(R.id.noteDuration)
        private val audioIndicator: LinearLayout = itemView.findViewById(R.id.audioIndicator)
        private val btnPlay: ImageButton = itemView.findViewById(R.id.btnPlayNote)
        private val btnSpeak: ImageButton = itemView.findViewById(R.id.btnSpeakNote)
        private val btnDelete: ImageButton = itemView.findViewById(R.id.btnDeleteNote)

        fun bind(note: Note) {
            noteTitle.text = note.title.ifEmpty { "Sesli Not" }
            noteContent.text = note.content.ifEmpty { "(Henüz yazıya çevrilmedi)" }
            noteDate.text = formatDate(note.createdAt)

            // Show audio indicator if audio exists
            if (note.audioFilePath != null) {
                audioIndicator.visibility = View.VISIBLE
                noteDuration.text = formatDuration(note.duration)
                btnPlay.visibility = View.VISIBLE
            } else {
                audioIndicator.visibility = View.GONE
                btnPlay.visibility = View.GONE
            }

            itemView.setOnClickListener { onNoteClick(note) }
            btnPlay.setOnClickListener { onPlayClick(note) }
            btnSpeak.setOnClickListener { onSpeakClick(note) }
            btnDelete.setOnClickListener { onDeleteClick(note) }
        }

        private fun formatDate(timestamp: Long): String {
            val now = Calendar.getInstance()
            val date = Calendar.getInstance().apply { timeInMillis = timestamp }

            return when {
                isSameDay(now, date) -> {
                    SimpleDateFormat("HH:mm", Locale("tr")).format(Date(timestamp))
                }
                isYesterday(now, date) -> "Dün"
                isSameYear(now, date) -> {
                    SimpleDateFormat("d MMM", Locale("tr")).format(Date(timestamp))
                }
                else -> {
                    SimpleDateFormat("d MMM yyyy", Locale("tr")).format(Date(timestamp))
                }
            }
        }

        private fun isSameDay(c1: Calendar, c2: Calendar): Boolean {
            return c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
                    c1.get(Calendar.DAY_OF_YEAR) == c2.get(Calendar.DAY_OF_YEAR)
        }

        private fun isYesterday(now: Calendar, date: Calendar): Boolean {
            val yesterday = now.clone() as Calendar
            yesterday.add(Calendar.DAY_OF_YEAR, -1)
            return isSameDay(yesterday, date)
        }

        private fun isSameYear(c1: Calendar, c2: Calendar): Boolean {
            return c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR)
        }

        private fun formatDuration(durationMs: Long): String {
            val minutes = TimeUnit.MILLISECONDS.toMinutes(durationMs)
            val seconds = TimeUnit.MILLISECONDS.toSeconds(durationMs) % 60
            return String.format("%02d:%02d", minutes, seconds)
        }
    }

    class NoteDiffCallback : DiffUtil.ItemCallback<Note>() {
        override fun areItemsTheSame(oldItem: Note, newItem: Note): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Note, newItem: Note): Boolean {
            return oldItem == newItem
        }
    }
}
