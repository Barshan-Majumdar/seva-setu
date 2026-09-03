package com.sevasetu.app.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Phase 2: Android Native Speech-to-Text (ASR)
 * Uses the native Android SpeechRecognizer to capture voice intents.
 */
class AsrEngine(private val context: Context) : RecognitionListener {

    private var speechRecognizer: SpeechRecognizer? = null
    var onTranscriptReceived: ((String) -> Unit)? = null
    var onErrorReceived: ((Int) -> Unit)? = null

    init {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
            speechRecognizer?.setRecognitionListener(this)
        }
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN") // Indian English
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        speechRecognizer?.startListening(intent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
    }

    fun destroy() {
        speechRecognizer?.destroy()
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}

    override fun onError(error: Int) {
        onErrorReceived?.invoke(error)
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (!matches.isNullOrEmpty()) {
            onTranscriptReceived?.invoke(matches[0])
        }
    }

    override fun onPartialResults(partialResults: Bundle?) {
        // Handle interim results if necessary for Wake Word
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (!matches.isNullOrEmpty()) {
            val transcript = matches[0].lowercase()
            if (transcript.contains("hey seva setu")) {
                // Wake word detected within partial results
                onTranscriptReceived?.invoke("WAKE_WORD_DETECTED")
            }
        }
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
}
