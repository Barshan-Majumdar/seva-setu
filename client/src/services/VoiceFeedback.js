import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * VoiceFeedback — Text-to-Speech service for SevaSetu voice replies.
 * Uses Capacitor Native TTS on Mobile, and Browser Speech Synthesis on Web.
 */
export const VoiceFeedback = {
  /**
   * Speak a message aloud to the user.
   * @param {string} message - The text to speak
   * @param {Function} [onEnd] - Optional callback when speech finishes
   */
  async speak(message, onEnd) {
    if (Capacitor.isNativePlatform()) {
      try {
        // Cancel any ongoing native speech
        await TextToSpeech.stop().catch(() => {});
        
        let hasFinished = false;
        let listenerHandle = null;

        if (onEnd) {
          // Listen to native progress to know EXACTLY when the speech ends
          listenerHandle = await TextToSpeech.addListener('onRangeStart', (info) => {
            // If the engine is speaking the very last word of the sentence
            if (info.end >= message.length - Math.max(10, message.length * 0.1)) {
              if (!hasFinished) {
                hasFinished = true;
                setTimeout(() => {
                  if (listenerHandle) listenerHandle.remove();
                  onEnd();
                }, 600); // 600ms buffer for the physical last word to finish
              }
            }
          });

          // Absolute fallback safety timeout (in case onRangeStart glitches)
          const fallbackMs = (message.length / 10) * 1000 + 2000;
          setTimeout(() => {
            if (!hasFinished) {
              hasFinished = true;
              if (listenerHandle) listenerHandle.remove();
              onEnd();
            }
          }, fallbackMs);
        }

        await TextToSpeech.speak({
          text: message,
          lang: 'en-IN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient', 
        });
      } catch (err) {
        console.error('[VoiceFeedback] Native TTS Error:', err);
        if (onEnd) onEnd();
      }
      return;
    }

    // --- Web Fallback below ---
    if (!window.speechSynthesis) {
      console.warn('[VoiceFeedback] Speech Synthesis not supported.');
      if (onEnd) onEnd();
      return;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'en-IN'; // Indian English
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-IN') 
                   || voices.find(v => v.lang.startsWith('en'))
                   || voices[0];
    if (preferred) {
      utterance.voice = preferred;
    }
    
    if (onEnd) {
      // We trust the browser's native onend event on Web, but keep a safety timeout 
      // just in case the browser completely fails to fire it.
      const maxTimeout = (message.length / 10) * 1000 + 5000; 

      const safetyTimeout = setTimeout(() => {
        utterance.onend = null;
        utterance.onerror = null;
        onEnd();
      }, maxTimeout);

      utterance.onend = () => {
        clearTimeout(safetyTimeout);
        onEnd();
      };
      utterance.onerror = () => {
        clearTimeout(safetyTimeout);
        onEnd();
      };
    }
    
    // Prevent Chrome from garbage collecting the utterance
    window.__speech_utterance = utterance;
    window.speechSynthesis.speak(utterance);
  },

  /** Stop any ongoing speech. */
  async stop() {
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.stop().catch(() => {});
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};
