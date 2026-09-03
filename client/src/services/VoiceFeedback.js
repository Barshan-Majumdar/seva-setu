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
        
        await TextToSpeech.speak({
          text: message,
          lang: 'en-IN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient', 
        });

        // The speak() promise resolves when speech finishes
        if (onEnd) {
          onEnd();
        }
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
      // Browser SpeechSynthesis onend events are notoriously buggy and can fire prematurely.
      // We enforce a STRICT minimum delay based on a very fast speaking rate (18 chars/sec).
      const minDurationMs = (message.length / 18) * 1000 + 400; 
      const maxTimeout = (message.length / 10) * 1000 + 5000; 
      
      const startTime = Date.now();
      let hasFinished = false;

      const finishAndResolve = () => {
        if (hasFinished) return;
        const elapsed = Date.now() - startTime;
        
        if (elapsed < minDurationMs) {
          // onend fired prematurely! Wait for the physical minimum duration.
          setTimeout(() => {
            if (!hasFinished) {
              hasFinished = true;
              onEnd();
            }
          }, minDurationMs - elapsed);
        } else {
          hasFinished = true;
          onEnd();
        }
      };

      const safetyTimeout = setTimeout(() => {
        utterance.onend = null;
        utterance.onerror = null;
        finishAndResolve();
      }, maxTimeout);

      utterance.onend = () => {
        clearTimeout(safetyTimeout);
        finishAndResolve();
      };
      utterance.onerror = () => {
        clearTimeout(safetyTimeout);
        finishAndResolve();
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
