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
    this._transcriptDebounce = null;

    // Callbacks
    this._onWakeWord = null;
    this._onTranscript = null;
    this._onPartialTranscript = null;
    this._onError = null;
    this._onEnd = null;

    // Debug
    this._debugLog = [];
    this._onDebugUpdate = null;
    
    // Restart tracking
    this._restartCount = 0;
    this._lastRestartTime = 0;
  }

  _log(msg) {
    const ts = new Date().toLocaleTimeString();
    const entry = `[${ts}] ${msg}`;
    console.log('[NativeSpeechBridge]', msg);
    this._debugLog.push(entry);
    if (this._debugLog.length > 30) this._debugLog.shift();
    if (this._onDebugUpdate) this._onDebugUpdate([...this._debugLog]);
  }

  getDebugLog() { return [...this._debugLog]; }

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
        this._log('🔔 listeningState: ' + data.status + ' (mode=' + this._mode + ', enabled=' + this._enabled + ')');
        if (data.status === 'started') {
          this._isListening = true;
        }
        if (data.status === 'stopped') {
          this._isListening = false;
          
          // Auto-restart if we're supposed to be listening
          // This is the CRITICAL path for always-on wake word detection
          if (this._enabled) {
            this._log('⟳ Auto-restart scheduled (mode=' + this._mode + ')');
            this._scheduleRestart(800);
          } else {
            this._log('Not restarting (enabled=false)');
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

    // Stop any current session WITHOUT disabling
    await this._stopHardware();

    this._mode = 'WAKE_WORD';
    this._enabled = true;  // MUST be set AFTER _stopHardware
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
    await this._stopHardware();

    this._mode = 'CONVERSATION';
    this._enabled = true;  // MUST be set AFTER _stopHardware
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
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    this._isListening = false;
    try { SpeechRecognition.stop(); } catch (e) {}
    this._log('⏹ Fully stopped');
  }

  // ── Pause (temporarily stop but keep mode) ──
  async pause() {
    this._enabled = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    try { SpeechRecognition.stop(); } catch (e) {}
    this._isListening = false;
    this._log('⏸ Paused');
  }

  // ── Internal: stop hardware WITHOUT touching _enabled or _mode ──
  async _stopHardware() {
    this._log('_stopHardware...');
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    this._isListening = false;
    try { 
      SpeechRecognition.stop(); // Do NOT await - plugin bug
    } catch (e) {}
    // Wait for Android hardware to release the audio track
    await new Promise(r => setTimeout(r, 400));
    this._log('_stopHardware complete');
  }

  // ── Internal: start the hardware mic ──
  async _startHardware() {
    if (!this._enabled) {
      this._log('_startHardware skipped (not enabled)');
      return;
    }
    if (this._isListening) {
      this._log('_startHardware skipped (already listening)');
      return;
    }

    // Try multiple configurations in case some fail on specific devices
    const configs = [
      { language: 'en-IN', partialResults: true, popup: false },
      { language: 'en-US', partialResults: true, popup: false },
      { partialResults: true, popup: false },
    ];

    for (let i = 0; i < configs.length; i++) {
      if (this._isListening || !this._enabled) return;
      
      try {
        this._log(`Trying start(${JSON.stringify(configs[i])})...`);
        await SpeechRecognition.start(configs[i]);
        this._isListening = true;
        this._restartCount++;
        this._lastRestartTime = Date.now();
        this._log('✅ start() OK (restart #' + this._restartCount + ')');
        return; // Success!
      } catch (e) {
        this._log(`❌ start() failed (config ${i}): ${e.message || e}`);
        this._isListening = false;
        // Wait before retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    // All configs failed — schedule another attempt
    if (this._enabled) {
      this._log('All start attempts failed, will retry in 2s');
      this._scheduleRestart(2000);
    }
  }

  // ── Internal: schedule auto-restart ──
  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(async () => {
      if (this._enabled && !this._isListening) {
        this._log('⟳ Auto-restart firing (mode=' + this._mode + ')');
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
    return `Mode: ${this._mode} | Listening: ${this._isListening} | Enabled: ${this._enabled} | Init: ${this._initialized} | Restarts: ${this._restartCount}`;
  }
}

export const nativeSpeechBridge = new NativeSpeechBridge();
export default nativeSpeechBridge;
