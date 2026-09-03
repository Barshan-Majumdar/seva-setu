import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/**
 * NativeSpeechBridge — Single owner of the Android SpeechRecognizer.
 * 
 * Android only allows ONE SpeechRecognizer session at a time, and the
 * @capacitor-community/speech-recognition plugin is a global singleton.
 * 
 * Previously, BackgroundVoiceService and SpeechService BOTH registered
 * their own listeners on this singleton, causing them to fight each other
 * and permanently kill the microphone (ERROR_RECOGNIZER_BUSY).
 * 
 * This bridge is the SOLE owner of the native plugin. All speech recognition
 * on Android goes through here. It supports two modes:
 *   - WAKE_WORD: Continuously listens for "Seva Setu" wake phrase
 *   - CONVERSATION: Active NLP conversation (transcript is forwarded to caller)
 */

const WAKE_WORDS = ['seva setu', 'seba setu', 'sheva setu', 'seva sethu', 'save a satu', 'seva set to', 'seva set u'];

class NativeSpeechBridge {
  constructor() {
    this._initialized = false;
    this._mode = 'IDLE'; // IDLE | WAKE_WORD | CONVERSATION
    this._isListening = false;
    this._enabled = false;
    this._restartTimeout = null;

    // Callbacks
    this._onWakeWord = null;
    this._onTranscript = null;       // final transcript (debounced)
    this._onPartialTranscript = null; // live interim text
    this._onError = null;
    this._onEnd = null;

    this._transcriptDebounce = null;
  }

  async init() {
    if (!Capacitor.isNativePlatform()) return false;
    if (this._initialized) return true;

    try {
      const { speechRecognition } = await SpeechRecognition.checkPermissions();
      if (speechRecognition !== 'granted') {
        await SpeechRecognition.requestPermissions();
      }
      const { available } = await SpeechRecognition.available();
      if (!available) {
        console.warn('[NativeBridge] Speech Recognition not available on device');
        return false;
      }

      // Remove any stale listeners from previous sessions
      await SpeechRecognition.removeAllListeners();

      // Register THE ONLY listeners for the entire app
      SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length > 0) {
          this._handleResult(data.matches[0]);
        }
      });

      SpeechRecognition.addListener('listeningState', (data) => {
        if (data.status === 'started') {
          this._isListening = true;
          console.log('[NativeBridge] 🎤 Mic is ON (mode: ' + this._mode + ')');
        }
        if (data.status === 'stopped') {
          this._isListening = false;
          console.log('[NativeBridge] 🔇 Mic is OFF (mode: ' + this._mode + ')');
          
          if (this._mode === 'CONVERSATION' && this._onEnd) {
            this._onEnd();
          }

          // Auto-restart if we're supposed to be listening
          if (this._enabled && (this._mode === 'WAKE_WORD' || this._mode === 'CONVERSATION')) {
            this._scheduleRestart(800);
          }
        }
      });

      this._initialized = true;
      console.log('[NativeBridge] ✅ Initialized successfully');
      return true;
    } catch (e) {
      console.error('[NativeBridge] Init error:', e);
      return false;
    }
  }

  _handleResult(transcript) {
    const text = transcript.trim();
    if (!text) return;

    if (this._mode === 'WAKE_WORD') {
      const lower = text.toLowerCase();
      const detected = WAKE_WORDS.some(ww => lower.includes(ww));
      if (detected && this._onWakeWord) {
        console.log('[NativeBridge] 🎤 Wake word detected:', lower);
        this._onWakeWord(lower);
      }
    } else if (this._mode === 'CONVERSATION') {
      // Send live partial transcripts for real-time UI updates
      if (this._onPartialTranscript) {
        this._onPartialTranscript(text);
      }

      // Debounce final transcript (wait 800ms of silence)
      clearTimeout(this._transcriptDebounce);
      this._transcriptDebounce = setTimeout(() => {
        if (this._onTranscript) {
          this._onTranscript(text);
        }
      }, 800);
    }
  }

  // ── Start listening for the wake word ──
  async startWakeWord(onWakeWordCb) {
    if (!this._initialized) {
      const ok = await this.init();
      if (!ok) return;
    }

    // Stop any active session first
    await this._hardStop();

    this._mode = 'WAKE_WORD';
    this._enabled = true;
    this._onWakeWord = onWakeWordCb;
    this._onTranscript = null;
    this._onPartialTranscript = null;
    this._onError = null;
    this._onEnd = null;

    await this._startHardware();
    console.log('[NativeBridge] 🟢 Wake word mode started');
  }

  // ── Start conversation mode (active NLP listening) ──
  async startConversation({ onTranscript, onPartialTranscript, onError, onEnd }) {
    if (!this._initialized) {
      const ok = await this.init();
      if (!ok) { if (onError) onError('not-supported'); return; }
    }

    // Stop any active session first (including wake word)
    await this._hardStop();

    this._mode = 'CONVERSATION';
    this._enabled = true;
    this._onWakeWord = null;
    this._onTranscript = onTranscript || null;
    this._onPartialTranscript = onPartialTranscript || null;
    this._onError = onError || null;
    this._onEnd = onEnd || null;

    await this._startHardware();
    console.log('[NativeBridge] 🟢 Conversation mode started');
  }

  // ── Stop everything ──
  async stop() {
    this._enabled = false;
    this._mode = 'IDLE';
    await this._hardStop();
    console.log('[NativeBridge] ⏹ Stopped');
  }

  // ── Pause (keep state, just stop hardware) ──
  async pause() {
    this._enabled = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    try { await SpeechRecognition.stop(); } catch (e) {}
    this._isListening = false;
    console.log('[NativeBridge] ⏸ Paused');
  }

  // ── Internal: force stop hardware ──
  async _hardStop() {
    this._enabled = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    this._isListening = false;
    try { await SpeechRecognition.stop(); } catch (e) {}
    // Wait for Android audio track to fully release
    await new Promise(r => setTimeout(r, 300));
  }

  // ── Internal: start the hardware mic with retry ──
  async _startHardware() {
    let retries = 3;
    while (retries > 0 && !this._isListening && this._enabled) {
      try {
        const options = retries === 3
          ? { language: 'en-IN', partialResults: true, popup: false }
          : (retries === 2 ? { partialResults: true, popup: false } : { partialResults: true });

        await SpeechRecognition.start(options);
        this._isListening = true;
        return;
      } catch (e) {
        console.warn(`[NativeBridge] Start error (retries: ${retries - 1}):`, e);
        retries--;
        this._isListening = false;
        await new Promise(r => setTimeout(r, 400));
      }
    }
    if (!this._isListening && this._onError) {
      this._onError('start-failed');
    }
  }

  // ── Internal: schedule auto-restart after Android auto-stops on silence ──
  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(async () => {
      if (this._enabled && !this._isListening) {
        await this._startHardware();
      }
    }, delayMs);
  }

  get isActive() {
    return this._enabled && this._isListening;
  }

  get mode() {
    return this._mode;
  }
}

export const nativeSpeechBridge = new NativeSpeechBridge();
export default nativeSpeechBridge;
