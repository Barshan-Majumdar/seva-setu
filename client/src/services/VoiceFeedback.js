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
          category: 'ambient', // iOS audio session category
        });
        
        // @capacitor-community/text-to-speech speak() promise resolves immediately when queued, 
        // NOT when finished. We must calculate the duration based on text length to prevent 
        // the microphone from turning on while the speaker is still talking (which causes an infinite loop).
        // Average speaking rate is ~14 characters per second, plus a 600ms buffer.
        if (onEnd) {
          const estimatedDurationMs = (message.length / 14) * 1000 + 600;
          setTimeout(() => {
            onEnd();
          }, estimatedDurationMs);
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
    
    // Prevent Chrome from garbage collecting the utterance
    window.__speech_utterance = utterance;
    
    window.speechSynthesis.speak(utterance);

    if (onEnd) {
      // Browser SpeechSynthesis onend events are notoriously buggy and can fire prematurely.
      // We forcibly calculate the strict minimum time it should take to speak the text 
      // (approx 13 chars per second) to guarantee the microphone never turns on while speaking.
      const estimatedDurationMs = (message.length / 13) * 1000 + 800;
      
      setTimeout(() => {
        onEnd();
      }, estimatedDurationMs);
    }
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
