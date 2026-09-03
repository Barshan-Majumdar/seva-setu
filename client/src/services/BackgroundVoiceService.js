/**
 * BackgroundVoiceService — Always-on "Seva Setu" wake word detection.
 * 
 * On native (Capacitor): Delegates entirely to nativeSpeechBridge to prevent
 * hardware race conditions. NativeSpeechBridge is the SOLE owner of the mic.
 * 
 * On web: Uses standard Web Speech API with automatic restart.
 */
import { Capacitor } from '@capacitor/core';
import { ForegroundService, ServiceType } from '@capawesome-team/capacitor-android-foreground-service';
import { nativeSpeechBridge } from './NativeSpeechBridge';

const WAKE_WORDS = ['seva setu', 'seba setu', 'sheva setu', 'seva sethu', 'save a satu', 'seva set to', 'seva set u'];

class BackgroundVoiceService {
  constructor() {
    this._recognition = null;
    this._isListening = false;
    this._onWakeWordDetected = null;
    this._restartTimeout = null;
    this._enabled = false;
    this._consecutiveErrors = 0;
    this._maxConsecutiveErrors = 5;
  }

  async init(onWakeWordDetected) {
    this._onWakeWordDetected = onWakeWordDetected;
    
    if (Capacitor.isNativePlatform()) {
      // Native wake word detection is completely delegated to NativeSpeechBridge
      const ok = await nativeSpeechBridge.init();
      return ok;
    } else {
      const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!WebSpeechRecognition) {
        console.warn('[BackgroundVoice] SpeechRecognition not available');
        return false;
      }
      this._recognition = new WebSpeechRecognition();
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      this._recognition.lang = 'en-IN';
      this._recognition.maxAlternatives = 3;

      this._recognition.onresult = (event) => {
        this._lastResultTime = Date.now();
        for (let i = event.resultIndex; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const transcript = event.results[i][j].transcript.toLowerCase().trim();
            const detected = WAKE_WORDS.some(ww => transcript.includes(ww));
            if (detected) {
              console.log('[BackgroundVoice] 🎤 Wake word detected:', transcript);
              this._consecutiveErrors = 0;
              this._backoffMs = 1000;
              this.pause();
              if (this._onWakeWordDetected) this._onWakeWordDetected(transcript);
              return;
            }
          }
        }
      };

      this._recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          this.stop();
          return;
        }
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          this._consecutiveErrors++;
        }
        if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
          this.stop();
          return;
        }
        this._backoffMs = Math.min(this._backoffMs * 1.5, 10000);
        this._scheduleRestart(this._backoffMs);
      };

      this._recognition.onend = () => {
        const sessionDuration = Date.now() - (this._lastStartTime || 0);
        if (sessionDuration < 2000) {
          this._backoffMs = Math.min(this._backoffMs * 1.5, 5000);
        } else {
          this._backoffMs = 1000;
        }
        if (this._enabled && this._isListening) {
          this._scheduleRestart(this._backoffMs);
        }
      };

      console.log('[BackgroundVoice] Web Initialized');
      return true;
    }
  }

  async start() {
    this._enabled = true;
    this._consecutiveErrors = 0;
    this._backoffMs = 1000;

    if (Capacitor.isNativePlatform()) {
      // 1. Command Android to keep the process alive
      await this._showForegroundNotification();

      // 2. Proxy to NativeSpeechBridge
      await nativeSpeechBridge.startWakeWord((text) => {
        this.pause(); // Pause wake word listening
        if (this._onWakeWordDetected) this._onWakeWordDetected(text);
      });
      this._isListening = true;
    } else {
      if (!this._recognition) return;
      try {
        this._isListening = true;
        this._recognition.start();
        this._lastStartTime = Date.now();
      } catch (err) {
        if (err.name !== 'InvalidStateError') {
          console.warn('[BackgroundVoice] Start error:', err.message);
          this._isListening = false;
          if (this._enabled) this._scheduleRestart(2000);
        }
      }
    }
  }

  pause() {
    this._isListening = false;
    clearTimeout(this._restartTimeout);
    if (Capacitor.isNativePlatform()) {
      nativeSpeechBridge.pause();
    } else {
      try { this._recognition?.stop(); } catch (e) {}
    }
  }

  resume() {
    if (!this._enabled) {
      this.start();
      return;
    }
    if (Capacitor.isNativePlatform()) {
      this.start();
    } else {
      this._scheduleRestart(600);
    }
  }

  stop() {
    this._enabled = false;
    this._isListening = false;
    clearTimeout(this._restartTimeout);
    if (Capacitor.isNativePlatform()) {
      nativeSpeechBridge.stop();
      this._hideForegroundNotification();
    } else {
      try { this._recognition?.stop(); } catch (e) {}
    }
    console.log('[BackgroundVoice] ⏹️ Stopped');
  }

  get isActive() {
    if (Capacitor.isNativePlatform()) {
      return nativeSpeechBridge.isActive && nativeSpeechBridge.mode === 'WAKE_WORD';
    }
    return this._enabled && this._isListening;
  }

  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(async () => {
      if (this._enabled && this._isListening) {
        if (!Capacitor.isNativePlatform()) {
          try {
            this._recognition?.start();
            this._lastStartTime = Date.now();
          } catch (err) {
            if (err.name !== 'InvalidStateError') console.warn('[BackgroundVoice] Restart error:', err.message);
          }
        }
      }
    }, delayMs);
  }

  async _showForegroundNotification() {
    try {
      if (Capacitor.isNativePlatform()) {
        await ForegroundService.startForegroundService({
          id: 1337,
          title: 'SevaSetu Active',
          body: 'Listening for emergency wake word...',
          smallIcon: 'ic_menu_mic', // Built-in Android icon fallback
          serviceType: ServiceType.Microphone,
        });
        console.log('[BackgroundVoice] ForegroundService active');
      }
    } catch (err) {
      console.error("Failed to lock background state:", err);
    }
  }

  async _hideForegroundNotification() {
    try {
      if (Capacitor.isNativePlatform()) {
        await ForegroundService.stopForegroundService();
        console.log('[BackgroundVoice] ForegroundService stopped');
      }
    } catch (err) {}
  }
}

export const backgroundVoiceService = new BackgroundVoiceService();
export default backgroundVoiceService;
