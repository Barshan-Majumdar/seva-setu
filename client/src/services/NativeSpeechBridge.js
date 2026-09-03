import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/**
 * NativeSpeechBridge — Single owner of the Android SpeechRecognizer.
 * 
 * Android only allows ONE SpeechRecognizer session at a time, and the
 * @capacitor-community/speech-recognition plugin is a global singleton.
 * 
 * This bridge is the SOLE owner of the native plugin. All speech recognition
 * on Android goes through here. It supports two modes:
 *   - WAKE_WORD: Continuously listens for "Seva Setu" wake phrase
 *   - CONVERSATION: Active NLP conversation (transcript is forwarded to caller)
 */

const WAKE_WORDS = [
  'seva setu', 'seba setu', 'sheva setu', 'seva sethu', 
  'save a satu', 'seva set to', 'seva set u',
  'sevasetu', 'sebasetu', 'shevasetu', 'hey sevasetu', 'hey seva setu'
];

class NativeSpeechBridge {
  constructor() {
    this._initialized = false;
    this._mode = 'IDLE'; // IDLE | WAKE_WORD | CONVERSATION
    this._isListening = false;
    this._enabled = false;
    this._restartTimeout = null;

    // Callbacks
    this._onWakeWord = null;
    this._onTranscript = null;
    this._onPartialTranscript = null;
    this._onError = null;
    this._onEnd = null;

    this._transcriptDebounce = null;

    // Debug log (visible on screen via getDebugLog())
    this._debugLog = [];
    this._maxLogLines = 30;
    this._onDebugUpdate = null; // UI callback to refresh debug display
  }

  _log(msg) {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    console.log('[NativeBridge] ' + msg);
    this._debugLog.push(line);
    if (this._debugLog.length > this._maxLogLines) {
      this._debugLog.shift();
    }
    if (this._onDebugUpdate) {
      try { this._onDebugUpdate([...this._debugLog]); } catch (e) {}
    }
  }

  getDebugLog() {
    return [...this._debugLog];
  }

  onDebugUpdate(cb) {
    this._onDebugUpdate = cb;
  }

  async init() {
    if (!Capacitor.isNativePlatform()) {
      this._log('Not native platform, skipping');
      return false;
    }
    if (this._initialized) {
      this._log('Already initialized');
      return true;
    }

    try {
      this._log('Checking permissions...');
      const { speechRecognition } = await SpeechRecognition.checkPermissions();
      this._log('Permission status: ' + speechRecognition);
      
      if (speechRecognition !== 'granted') {
        this._log('Requesting permissions...');
        const result = await SpeechRecognition.requestPermissions();
        this._log('Permission result: ' + result.speechRecognition);
        if (result.speechRecognition !== 'granted') {
          this._log('❌ Permission denied');
          return false;
        }
      }

      // Check availability (log only, don't block)
      try {
        const { available } = await SpeechRecognition.available();
        this._log('Available check: ' + available);
      } catch (e) {
        this._log('Available check failed: ' + e.message);
      }

      // Remove any stale listeners
      try { await SpeechRecognition.removeAllListeners(); } catch (e) {}
      this._log('Cleared old listeners');

      // Register THE ONLY listeners for the entire app
      await SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length > 0) {
          this._log('📝 Got speech: "' + data.matches[0].substring(0, 50) + '"');
          this._handleResult(data.matches[0]);
        }
      });

      await SpeechRecognition.addListener('listeningState', (data) => {
        this._log('🔔 listeningState: ' + data.status);
        if (data.status === 'started') {
          this._isListening = true;
        }
        if (data.status === 'stopped') {
          this._isListening = false;
          
          if (this._mode === 'CONVERSATION' && this._onEnd) {
            this._onEnd();
          }

          // Auto-restart if we're supposed to be listening
          if (this._enabled && (this._mode === 'WAKE_WORD' || this._mode === 'CONVERSATION')) {
            this._log('Scheduling auto-restart...');
            this._scheduleRestart(1000);
          }
        }
      });

      this._initialized = true;
      this._log('✅ Initialized OK');
      return true;
    } catch (e) {
      this._log('❌ Init error: ' + (e.message || e));
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
        this._log('🎤 WAKE WORD DETECTED: ' + lower);
        this._onWakeWord(lower);
      }
    } else if (this._mode === 'CONVERSATION') {
      if (this._onPartialTranscript) {
        this._onPartialTranscript(text);
      }

      clearTimeout(this._transcriptDebounce);
      this._transcriptDebounce = setTimeout(() => {
        if (this._onTranscript) {
          this._log('💬 Final transcript: "' + text.substring(0, 50) + '"');
          this._onTranscript(text);
        }
      }, 3000); // 3 seconds of silence before we assume they are done speaking
    }
  }

  // ── Start listening for the wake word ──
  async startWakeWord(onWakeWordCb) {
    this._log('startWakeWord() called');
    
    if (!this._initialized) {
      const ok = await this.init();
      if (!ok) { this._log('Cannot start wake word - init failed'); return; }
    }

    await this._hardStop();

    this._mode = 'WAKE_WORD';
    this._enabled = true;
    this._onWakeWord = onWakeWordCb;
    this._onTranscript = null;
    this._onPartialTranscript = null;
    this._onError = null;
    this._onEnd = null;

    await this._startHardware();
  }

  // ── Start conversation mode ──
  async startConversation({ onTranscript, onPartialTranscript, onError, onEnd }) {
    this._log('startConversation() called');
    
    if (!this._initialized) {
      const ok = await this.init();
      if (!ok) { 
        this._log('Cannot start conversation - init failed');
        if (onError) onError('not-supported'); 
        return; 
      }
    }

    this._log('Stopping previous session...');
    await this._hardStop();

    this._mode = 'CONVERSATION';
    this._enabled = true;
    this._onWakeWord = null;
    this._onTranscript = onTranscript || null;
    this._onPartialTranscript = onPartialTranscript || null;
    this._onError = onError || null;
    this._onEnd = onEnd || null;

    this._log('Starting hardware...');
    await this._startHardware();
  }

  // ── Stop everything ──
  async stop() {
    this._enabled = false;
    this._mode = 'IDLE';
    await this._hardStop();
    this._log('⏹ Fully stopped');
  }

  // ── Pause ──
  async pause() {
    this._enabled = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    try { SpeechRecognition.stop(); } catch (e) {}
    this._isListening = false;
    this._log('⏸ Paused');
  }

  // ── Internal: force stop hardware ──
  async _hardStop() {
    this._log('Executing _hardStop...');
    this._enabled = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    this._isListening = false;
    try { 
      this._log('Calling native stop() (no await due to plugin bug)...');
      SpeechRecognition.stop(); // CRITICAL: Do NOT await, the plugin never resolves this promise!
      this._log('Native stop() fired');
    } catch (e) {
      this._log('Native stop() error: ' + e.message);
    }
    // Wait for Android hardware to release the audio track
    this._log('Waiting 500ms for hardware release...');
    await new Promise(r => setTimeout(r, 500));
    this._log('_hardStop complete');
  }

  // ── Internal: start the hardware mic ──
  async _startHardware() {
    // Try multiple configurations in case some fail on specific devices
    const configs = [
      { language: 'en-IN', partialResults: true, popup: false },
      { language: 'en-US', partialResults: true, popup: false },
      { partialResults: true, popup: false },
      { partialResults: true },
    ];

    for (let i = 0; i < configs.length; i++) {
      if (this._isListening || !this._enabled) return;
      
      try {
        this._log(`Trying start(${JSON.stringify(configs[i])})...`);
        await SpeechRecognition.start(configs[i]);
        this._isListening = true;
        this._log('✅ start() resolved OK');
        
        // Verify after a short delay that we're actually listening
        // (the Java plugin resolves immediately for partialResults)
        await new Promise(r => setTimeout(r, 500));
        try {
          const { listening } = await SpeechRecognition.isListening();
          this._log('isListening() check: ' + listening);
          if (listening) return; // Success!
          // Not actually listening despite start() resolving
          this._isListening = false;
          this._log('⚠ start() resolved but not actually listening');
        } catch (e) {
          // isListening() might not work on all versions
          this._log('isListening() check failed: ' + e.message);
          return; // Assume it worked
        }
      } catch (e) {
        this._log(`❌ start() failed (config ${i}): ${e.message || e}`);
        this._isListening = false;
        // Wait before retry
        await new Promise(r => setTimeout(r, 600));
      }
    }
    
    if (!this._isListening) {
      this._log('❌ ALL start attempts failed');
      if (this._onError) this._onError('start-failed');
    }
  }

  // ── Internal: schedule auto-restart ──
  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(async () => {
      if (this._enabled && !this._isListening) {
        this._log('Auto-restarting...');
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

  get statusText() {
    return `Mode: ${this._mode} | Listening: ${this._isListening} | Enabled: ${this._enabled} | Init: ${this._initialized}`;
  }
}

export const nativeSpeechBridge = new NativeSpeechBridge();
export default nativeSpeechBridge;
