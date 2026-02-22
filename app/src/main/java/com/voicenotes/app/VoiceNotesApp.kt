package com.voicenotes.app

import android.app.Application

class VoiceNotesApp : Application() {

    lateinit var database: NoteDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = NoteDatabase.getInstance(this)
    }

    companion object {
        lateinit var instance: VoiceNotesApp
            private set
    }
}
