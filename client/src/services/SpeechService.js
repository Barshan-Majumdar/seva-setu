/**
 * SpeechService — Web Speech API wrapper for SevaSetu voice assistant.
 * 
 * Lazily initialized to avoid crashing on browsers that don't support 
 * the Web Speech API (e.g. Firefox, server-side rendering).
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

  /**
   * Lazily initialize the SpeechRecognition instance.
   * Returns true if initialization succeeded, false otherwise.
   */
  _ensureInitialized() {
    if (this._initialized) return !!this.recognition;
    this._initialized = true;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SpeechService] Web Speech API is not supported in this browser.');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-IN'; // Indian English

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[SpeechService] Started listening...');
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const fullText = (finalTranscript || interimTranscript).toLowerCase().trim();

      // Check for wake word (fire only once per session)
      const compressedText = fullText.replace(/\s+/g, '');
      // Account for common Speech-to-Text mistranscriptions of "Seva Setu"
      const wakeWordRegex = /(?:hey|hi|hello|ok|okay)?\s*(seva|sewa|siva|shiva|seba|sayva|save\s*a|say\s*wa)\s*(setu|sethu|setoo|said\s*to|say\s*to|c2)/i;
      
      const wakeWordMatch = wakeWordRegex.test(fullText) || 
                            wakeWordRegex.test(compressedText) ||
                            compressedText.includes('sevasetu') ||
                            compressedText.includes('sevasethu') ||
                            compressedText.includes('shivasetu') ||
                            compressedText.includes('hisevasetu') ||
                            compressedText.includes('heyseva');
      if (!this._wakeWordFired && wakeWordMatch && this._onWakeWord) {
        console.log('[SpeechService] Wake word detected!');
        this._wakeWordFired = true;
        this._onWakeWord();
      }

      // Pass final transcripts to the callback
      if (finalTranscript.trim() && this._onTranscript) {
        // Strip wake word from the transcript so the NLP only gets the emergency description
        let cleaned = finalTranscript.trim();
        
        // Use regex to strip wake word at the start (accounting for misspellings)
        const wakeWordStripRegex = /^(?:hey|hi|hello|ok|okay)?\s*(seva|sewa|siva|shiva|seba|sayva|save\s*a|say\s*wa)\s*(setu|sethu|setoo|said\s*to|say\s*to|c2)\b/i;
        cleaned = cleaned.replace(wakeWordStripRegex, '').trim();
        
        // Try fallback removals
        ['hey sevasetu', 'hey seva setu', 'hey seva', 'sevasetu', 'sevasethu', 'seva setu', 'seva sethu'].forEach(w => {
          if (cleaned.toLowerCase().startsWith(w)) {
            cleaned = cleaned.substring(w.length).trim();
          }
        });
        
        if (cleaned.length > 0) {
          this._onTranscript(cleaned);
        }
      }
    };

    this.recognition.onerror = (event) => {
      // 'no-speech' is not a real error, just silence timeout
      if (event.error === 'no-speech') return;
      console.error('[SpeechService] Error:', event.error);
      this.isListening = false;
      if (this._onError) this._onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('[SpeechService] Stopped listening.');
      if (this._onEnd) this._onEnd();
      
      // Auto-restart if we didn't explicitly call stop()
      if (this._autoRestart) {
        console.log('[SpeechService] Auto-restarting recognition...');
        setTimeout(() => {
          if (!this.isListening) {
            try { this.recognition.start(); } catch (e) {}
          }
        }, 500);
      }
    };

    return true;
  }

  /**
   * Start listening.
   * @param {Function|null} onWakeWordCb - Called when "Hey Seva Setu" is detected.
   * @param {Function|null} onTranscriptCb - Called with the final transcript text.
   * @param {Function|null} onErrorCb - Called on error.
   * @param {Function|null} onEndCb - Called when the recognition service disconnects.
   */
  start(onWakeWordCb, onTranscriptCb, onErrorCb, onEndCb = null) {
    if (!this._ensureInitialized()) {
      if (onErrorCb) onErrorCb('not-supported');
      return;
    }
    
    this._onWakeWord = onWakeWordCb || (() => {}); // never null
    this._onTranscript = onTranscriptCb || (() => {});
    this._onError = onErrorCb || (() => {});
    this._onEnd = onEndCb;
    this._wakeWordFired = false;
    // If it's a wake word listener (no transcript callback usually, or we just always want it persistent until stop() is called)
    this._autoRestart = true;

    if (!this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        // Already started — safe to ignore
        console.warn('[SpeechService] Could not start recognition:', e.message);
      }
    }
  }

  stop() {
    this._autoRestart = false; // Disable auto-restart when explicitly stopped
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped — safe to ignore
      }
    }
    this._wakeWordFired = false;
  }

  /** Returns true if the browser supports the Web Speech API. */
  get isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export const speechService = new SpeechService();
