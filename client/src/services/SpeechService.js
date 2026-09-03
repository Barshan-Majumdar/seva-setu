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
    if (this._initialized) return true;
    try {
      const { speechRecognition } = await SpeechRecognition.checkPermissions();
      if (speechRecognition !== 'granted') {
        await SpeechRecognition.requestPermissions();
      }
      const { available } = await SpeechRecognition.available();
      if (!available) {
        console.warn('[SpeechService] Native Speech Recognition not available');
        return false;
      }

      SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length > 0) {
          const finalTranscript = data.matches[0];
          this._processTranscript(finalTranscript);
        }
      });
      
      // Native plugin stops automatically on silence
      SpeechRecognition.addListener('listeningState', (data) => {
        if (data.status === 'stopped') {
          this.isListening = false;
          if (this._onEnd) this._onEnd();
          if (this._autoRestart) {
            setTimeout(() => {
              if (!this.isListening) {
                try { SpeechRecognition.start({ language: 'en-IN', partialResults: true, popup: false }); this.isListening = true; } catch (e) {}
              }
            }, 500);
          }
        }
      });
      
      this._initialized = true;
      return true;
    } catch (e) {
      console.error('[SpeechService] Native Init Error:', e);
      return false;
    }
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
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }
      this._processTranscript(finalTranscript || interimTranscript);
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
        setTimeout(() => {
          if (!this.isListening) {
            try { this.recognition.start(); } catch (e) {}
          }
        }, 500);
      }
    };

    this._initialized = true;
    return true;
  }

  _processTranscript(transcript) {
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

    if (transcript.trim() && this._onTranscript) {
      let cleaned = transcript.trim();
      const wakeWordStripRegex = /^(?:hey|hi|hello|ok|okay)?\s*(seva|sewa|siva|shiva|seba|sayva|save\s*a|say\s*wa)\s*(setu|sethu|setoo|said\s*to|say\s*to|c2)\b/i;
      cleaned = cleaned.replace(wakeWordStripRegex, '').trim();
      
      ['hey sevasetu', 'hey seva setu', 'hey seva', 'sevasetu', 'sevasethu', 'seva setu', 'seva sethu'].forEach(w => {
        if (cleaned.toLowerCase().startsWith(w)) {
          cleaned = cleaned.substring(w.length).trim();
        }
      });
      
      if (cleaned.length > 0) {
        this._onTranscript(cleaned);
      }
    }
  }

  async start(onWakeWordCb, onTranscriptCb, onErrorCb, onEndCb = null) {
    this._onWakeWord = onWakeWordCb || (() => {});
    this._onTranscript = onTranscriptCb || (() => {});
    this._onError = onErrorCb || (() => {});
    this._onEnd = onEndCb;
    this._wakeWordFired = false;
    this._autoRestart = true;

    if (Capacitor.isNativePlatform()) {
      const ok = await this._ensureNativeInitialized();
      if (!ok) { if (onErrorCb) onErrorCb('not-supported'); return; }
      if (!this.isListening) {
        try {
          await SpeechRecognition.start({ language: 'en-IN', partialResults: true, popup: false });
          this.isListening = true;
        } catch (e) {
          console.warn('[SpeechService] Native start error:', e);
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
    if (Capacitor.isNativePlatform()) {
      if (this.isListening) {
        try { await SpeechRecognition.stop(); this.isListening = false; } catch (e) {}
      }
    } else {
      if (this.recognition && this.isListening) {
        try { this.recognition.stop(); } catch (e) {}
      }
    }
  }

  get isSupported() {
    return Capacitor.isNativePlatform() || !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export const speechService = new SpeechService();
