/**
 * BackgroundVoiceService — Always-on "Seva Setu" wake word detection.
 * 
 * On native (Capacitor): Uses a foreground service notification to keep 
 * the app alive in the background. The mic stays open and continuously 
 * listens for the wake word "seva setu" even when the screen is locked.
 * 
 * On web: Uses standard Web Speech API with automatic restart.
 * 
 * Architecture:
 *   - Continuous SpeechRecognition loop
 *   - Wake word detection: "seva setu", "seba setu", "sheva setu" (fuzzy)
 *   - On wake word detected → triggers the VoiceEmergencyModal
 *   - Foreground notification keeps Android from killing the process
 */
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

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
    this._nativeInitialized = false;
  }

  async init(onWakeWordDetected) {
    this._onWakeWordDetected = onWakeWordDetected;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const { speechRecognition } = await SpeechRecognition.checkPermissions();
        if (speechRecognition !== 'granted') {
          await SpeechRecognition.requestPermissions();
        }
        
        SpeechRecognition.addListener('partialResults', (data) => {
          this._lastResultTime = Date.now();
          if (data.matches && data.matches.length > 0) {
            const transcript = data.matches[0].toLowerCase().trim();
            const detected = WAKE_WORDS.some(ww => transcript.includes(ww));
            if (detected) {
              console.log('[BackgroundVoice] 🎤 Wake word detected:', transcript);
              this._consecutiveErrors = 0;
              this._backoffMs = 1000;
              this.pause();
              if (this._onWakeWordDetected) this._onWakeWordDetected(transcript);
            }
          }
        });

        SpeechRecognition.addListener('listeningState', (data) => {
          if (data.status === 'stopped') {
            this._isListening = false;
            if (this._enabled) {
              this._scheduleRestart(1000);
            }
          }
        });
        this._nativeInitialized = true;
        console.log('[BackgroundVoice] Native Initialized');
        return true;
      } catch (err) {
        console.error('[BackgroundVoice] Native Init Error:', err);
        return false;
      }
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
    if (!Capacitor.isNativePlatform() && !this._recognition) return;
    this._enabled = true;
    this._consecutiveErrors = 0;
    this._backoffMs = 1000;

    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.start({ language: 'en-IN', partialResults: true, popup: false });
        this._isListening = true;
        this._lastStartTime = Date.now();
        this._showForegroundNotification();
      } catch (err) {
        console.warn('[BackgroundVoice] Native start error:', err);
        this._isListening = false;
        // Schedule a restart since it failed to start
        if (this._enabled) {
          this._scheduleRestart(2000);
        }
      }
    } else {
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
      try { SpeechRecognition.stop(); } catch (e) {}
    } else {
      try { this._recognition?.stop(); } catch (e) {}
    }
  }

  resume() {
    if (!this._enabled) {
      this.start();
      return;
    }
    this._scheduleRestart(600);
  }

  stop() {
    this._enabled = false;
    this._isListening = false;
    clearTimeout(this._restartTimeout);
    if (Capacitor.isNativePlatform()) {
      try { SpeechRecognition.stop(); } catch (e) {}
    } else {
      try { this._recognition?.stop(); } catch (e) {}
    }
    console.log('[BackgroundVoice] ⏹️ Stopped');
  }

  get isActive() {
    return this._enabled && this._isListening;
  }

  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(async () => {
      if (this._enabled && this._isListening) {
        if (Capacitor.isNativePlatform()) {
          try {
            await SpeechRecognition.start({ language: 'en-IN', partialResults: true, popup: false });
            this._lastStartTime = Date.now();
          } catch (err) {
            console.warn('[BackgroundVoice] Native restart error:', err);
          }
        } else {
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

  _showForegroundNotification() {
    try {
      if (window.Capacitor?.Plugins?.LocalNotifications) {
        window.Capacitor.Plugins.LocalNotifications.schedule({
          notifications: [{
            id: 99999,
            title: 'SevaSetu is listening',
            body: 'Say "Seva Setu" to activate emergency assistance',
            ongoing: true,
            autoCancel: false,
            smallIcon: 'ic_stat_icon_config_sample'
          }]
        });
      }
    } catch (err) {}
  }
}

export const backgroundVoiceService = new BackgroundVoiceService();
export default backgroundVoiceService;
