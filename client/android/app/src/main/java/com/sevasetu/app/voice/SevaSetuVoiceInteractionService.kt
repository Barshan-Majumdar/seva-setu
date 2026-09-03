package com.sevasetu.app.voice

import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.service.voice.VoiceInteractionService

/**
 * Phase 5: Android Screen-Off VoiceInteractionService
 * This is the officially supported Android system path to maintain hotwording
 * while the screen is completely off, replacing the need for Gemini or App Actions.
 */

// 1. The main service that runs continuously for hotword detection
class SevaSetuVoiceInteractionService : VoiceInteractionService() {
    override fun onReady() {
        super.onReady()
        // Here we would bind our WakeWordEngine (e.g. Porcupine)
        println("[SevaSetuVoiceService] Service is ready and listening in the background.")
    }

    // Called when the hotword "Hey SevaSetu" is physically detected by the WakeWordEngine
    private fun onWakeWordDetected() {
        // Launches the active voice session
        showSession(Bundle(), VoiceInteractionSession.SHOW_WITH_ASSIST)
    }
}

// 2. The session service that handles the actual voice interaction once triggered
class SevaSetuVoiceSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return SevaSetuVoiceSession(this)
    }
}

// 3. The session itself where we capture ASR and route to EmergencyManager
class SevaSetuVoiceSession(context: android.content.Context) : VoiceInteractionSession(context) {

    private val asrEngine = AsrEngine(context)
    
    override fun onCreate() {
        super.onCreate()
        asrEngine.onTranscriptReceived = { transcript ->
            println("[SevaSetuVoiceSession] Transcript: $transcript")
            // Here we would trigger the EmergencyManager minimum SOS
            // and asynchronously send the transcript to the AI backend.
            finish() // End session once transcript is received and queued
        }
        asrEngine.onErrorReceived = {
            // Handle error, fallback to non-voice SOS
            finish()
        }
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        // Start listening to the emergency request as soon as the session appears
        asrEngine.startListening()
    }

    override fun onHide() {
        super.onHide()
        asrEngine.stopListening()
    }
}
