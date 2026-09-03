import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/**
 * SpeechService — Speech Recognition wrapper for SevaSetu voice assistant.
 * Uses Capacitor Speech Recognition on mobile, and Web Speech API on browser.
 */
export class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this._onTranscript = null;
    this._onWakeWord = null;
    this._onError = null;
    this._onEnd = null;
    this._autoRestart = false;
    this._wakeWordFired = false;
    this.WAKE_WORD = 'hey seva setu';
    this._initialized = false;
  }

  async _ensureNativeInitialized() {
    // On native, NativeSpeechBridge is the sole owner of the Android SpeechRecognizer.
    // SpeechService must NEVER register its own listeners on native — they would
    // conflict with NativeSpeechBridge and permanently kill the microphone.
    console.warn('[SpeechService] _ensureNativeInitialized blocked — use NativeSpeechBridge on native');
    return false;
  }

  _ensureWebInitialized() {
    if (this._initialized) return !!this.recognition;
    
    const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!WebSpeechRecognition) {
      console.warn('[SpeechService] Web Speech API not supported.');
      return false;
    }

    this.recognition = new WebSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-IN';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let isFinalOverall = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          isFinalOverall = true;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      this._processTranscript(finalTranscript || interimTranscript, isFinalOverall);
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      this.isListening = false;
      if (this._onError) this._onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this._onEnd) this._onEnd();
      if (this._autoRestart) {
        clearTimeout(this._restartTimeout);
        this._restartTimeout = setTimeout(() => {
          if (!this.isListening && this._autoRestart) {
            try { this.recognition.start(); } catch (e) {}
          }
        }, 500);
      }
    };

    this._initialized = true;
    return true;
  }

  _processTranscript(transcript, isFinal = false) {
    const fullText = transcript.toLowerCase().trim();
    const compressedText = fullText.replace(/\s+/g, '');
    const wakeWordRegex = /(?:hey|hi|hello|ok|okay)?\s*(seva|sewa|siva|shiva|seba|sayva|save\s*a|say\s*wa)\s*(setu|sethu|setoo|said\s*to|say\s*to|c2)/i;
    
    const wakeWordMatch = wakeWordRegex.test(fullText) || 
                          wakeWordRegex.test(compressedText) ||
                          compressedText.includes('sevasetu') ||
                          compressedText.includes('sevasethu') ||
                          compressedText.includes('shivasetu') ||
                          compressedText.includes('hisevasetu') ||
                          compressedText.includes('heyseva');
    
    if (!this._wakeWordFired && wakeWordMatch && this._onWakeWord) {
      this._wakeWordFired = true;
      this._onWakeWord();
    }

    if (transcript.trim()) {
      let cleaned = transcript.trim();
      const wakeWordStripRegex = /^(?:hey|hi|hello|ok|okay)?\s*(seva|sewa|siva|shiva|seba|sayva|save\s*a|say\s*wa)\s*(setu|sethu|setoo|said\s*to|say\s*to|c2)\b/i;
      cleaned = cleaned.replace(wakeWordStripRegex, '').trim();
      
      ['hey sevasetu', 'hey seva setu', 'hey seva', 'sevasetu', 'sevasethu', 'seva setu', 'seva sethu'].forEach(w => {
        if (cleaned.toLowerCase().startsWith(w)) {
          cleaned = cleaned.substring(w.length).trim();
        }
      });
      
      if (cleaned.length > 0) {
        if (this._onPartialTranscript) {
          this._onPartialTranscript(cleaned);
        }

        if (this._onTranscript) {
          clearTimeout(this._transcriptDebounce);
          
          // If the speech engine guarantees this is the final sentence, execute instantly.
          if (isFinal) {
            this._onTranscript(cleaned);
          } else {
            // Otherwise, wait for 800ms of silence (debounce)
            this._transcriptDebounce = setTimeout(() => {
              this._onTranscript(cleaned);
            }, 800);
          }
        }
      }
    }
  }

  async start(onWakeWordCb, onTranscriptCb, onErrorCb, onEndCb = null, onPartialTranscriptCb = null) {
    this._onWakeWord = onWakeWordCb || (() => {});
    this._onTranscript = onTranscriptCb || (() => {});
    this._onError = onErrorCb || (() => {});
    this._onEnd = onEndCb;
    this._onPartialTranscript = onPartialTranscriptCb;
    this._wakeWordFired = false;
    this._autoRestart = true;

    if (Capacitor.isNativePlatform()) {
      const ok = await this._ensureNativeInitialized();
      if (!ok) { if (onErrorCb) onErrorCb('not-supported'); return; }

      // Force stop any active hardware recording session and wait for Android hardware release
      try { await SpeechRecognition.stop(); } catch (e) {}
      await new Promise(r => setTimeout(r, 250));

      let retries = 3;
      while (retries > 0 && !this.isListening) {
        try {
          // Attempt 1: en-IN + popup:false
          // Attempt 2: device default locale + popup:false
          // Attempt 3: device default locale without popup restriction
          const options = retries === 3 
            ? { language: 'en-IN', partialResults: true, popup: false }
            : (retries === 2 ? { partialResults: true, popup: false } : { partialResults: true });

          await SpeechRecognition.start(options);
          this.isListening = true;
          console.log('[SpeechService] Native SpeechRecognition started successfully!');
          break;
        } catch (e) {
          console.warn(`[SpeechService] Native start error (retries left: ${retries - 1}):`, e);
          retries--;
          this.isListening = false;
          await new Promise(r => setTimeout(r, 350));
        }
      }
    } else {
      const ok = this._ensureWebInitialized();
      if (!ok) { if (onErrorCb) onErrorCb('not-supported'); return; }
      if (!this.isListening) {
        try { this.recognition.start(); } catch (e) {}
      }
    }
  }

  async stop() {
    this._autoRestart = false;
    this._wakeWordFired = false;
    clearTimeout(this._restartTimeout);
    clearTimeout(this._transcriptDebounce);
    
    if (Capacitor.isNativePlatform()) {
      this.isListening = false;
      try { await SpeechRecognition.stop(); } catch (e) {}
    } else {
      if (this.recognition && this.isListening) {
        try { this.recognition.stop(); } catch (e) {}
      }
    }
  }

  async checkPermissions() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { speechRecognition } = await SpeechRecognition.checkPermissions();
        return speechRecognition === 'granted';
      } catch (err) {
        return false;
      }
    } else {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' });
          return result.state === 'granted';
        } catch (err) {
          return false;
        }
      }
      return false;
    }
  }

  get isSupported() {
    return Capacitor.isNativePlatform() || !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export const speechService = new SpeechService();
