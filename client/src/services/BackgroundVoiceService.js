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

  /**
   * Initialize the background voice listener.
   * @param {Function} onWakeWordDetected - Callback when "Seva Setu" is heard
   */
  init(onWakeWordDetected) {
    this._onWakeWordDetected = onWakeWordDetected;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[BackgroundVoice] SpeechRecognition not available');
      return false;
    }

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = 'en-IN';
    this._recognition.maxAlternatives = 3;

    this._recognition.onresult = (event) => {
      this._lastResultTime = Date.now();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Check all alternatives for wake word
        for (let j = 0; j < event.results[i].length; j++) {
          const transcript = event.results[i][j].transcript.toLowerCase().trim();
          
          const detected = WAKE_WORDS.some(ww => transcript.includes(ww));
          if (detected) {
            console.log('[BackgroundVoice] 🎤 Wake word detected:', transcript);
            this._consecutiveErrors = 0;
            this._backoffMs = 1000;
            
            // Temporarily stop listening to prevent self-hearing
            this.pause();
            
            // Trigger the emergency modal
            if (this._onWakeWordDetected) {
              this._onWakeWordDetected(transcript);
            }
            return;
          }
        }
      }
    };

    this._recognition.onerror = (event) => {
      console.warn('[BackgroundVoice] Error:', event.error);
      
      if (event.error === 'not-allowed') {
        console.error('[BackgroundVoice] Mic permission denied. Stopping service.');
        this.stop();
        return;
      }

      // 'no-speech' is expected when user is quiet — don't count as hard error
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this._consecutiveErrors++;
      }
      
      if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
        console.error('[BackgroundVoice] Too many errors, stopping to prevent infinite loops');
        this.stop();
        return;
      }
      
      // Increase backoff on errors to prevent flickering
      this._backoffMs = Math.min(this._backoffMs * 1.5, 10000);
      this._scheduleRestart(this._backoffMs);
    };

    this._recognition.onend = () => {
      // If we just started and it ended immediately, increase backoff
      const sessionDuration = Date.now() - (this._lastStartTime || 0);
      if (sessionDuration < 2000) {
        this._backoffMs = Math.min(this._backoffMs * 1.5, 5000);
      } else {
        this._backoffMs = 1000; // Reset backoff if we had a healthy session
      }

      // Auto-restart if we're supposed to be listening
      if (this._enabled && this._isListening) {
        this._scheduleRestart(this._backoffMs);
      }
    };

    console.log('[BackgroundVoice] Initialized');
    return true;
  }

  /**
   * Start continuous background listening
   */
  start() {
    if (!this._recognition) {
      console.warn('[BackgroundVoice] Not initialized');
      return;
    }

    this._enabled = true;
    this._isListening = true;
    this._consecutiveErrors = 0;
    this._backoffMs = 1000;

    try {
      this._recognition.start();
      this._lastStartTime = Date.now();
      console.log('[BackgroundVoice] ▶️ Listening for wake word...');
    } catch (err) {
      // Already started
      if (err.name !== 'InvalidStateError') {
        console.warn('[BackgroundVoice] Start error:', err.message);
      }
    }

    // On native, show foreground notification
    if (Capacitor.isNativePlatform()) {
      this._showForegroundNotification();
    }
  }

  /**
   * Temporarily pause (e.g., while the AI is speaking)
   */
  pause() {
    this._isListening = false;
    clearTimeout(this._restartTimeout);
    try {
      this._recognition?.stop();
    } catch {}
  }

  /**
   * Resume after pause (e.g., after AI finishes speaking)
   */
  resume() {
    if (!this._enabled) return;
    this._isListening = true;
    this._scheduleRestart(600); // Brief delay to let audio settle
  }

  /**
   * Fully stop background listening
   */
  stop() {
    this._enabled = false;
    this._isListening = false;
    clearTimeout(this._restartTimeout);
    try {
      this._recognition?.stop();
    } catch {}
    console.log('[BackgroundVoice] ⏹️ Stopped');
  }

  /**
   * Whether the service is currently active
   */
  get isActive() {
    return this._enabled && this._isListening;
  }

  // ── Private ──

  _scheduleRestart(delayMs) {
    clearTimeout(this._restartTimeout);
    this._restartTimeout = setTimeout(() => {
      if (this._enabled && this._isListening) {
        try {
          this._recognition?.start();
          this._lastStartTime = Date.now();
        } catch (err) {
          if (err.name !== 'InvalidStateError') {
            console.warn('[BackgroundVoice] Restart error:', err.message);
          }
        }
      }
    }, delayMs);
  }

  _showForegroundNotification() {
    // On Android, Capacitor's LocalNotifications can show a persistent notification
    // This keeps the app process alive in the background
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
    } catch (err) {
      console.warn('[BackgroundVoice] Notification error:', err.message);
    }
  }
}

// Singleton instance
export const backgroundVoiceService = new BackgroundVoiceService();
export default backgroundVoiceService;
