/**
 * VoiceFeedback — Text-to-Speech service for SevaSetu voice replies.
 * Uses the browser's built-in Speech Synthesis API.
 */
export const VoiceFeedback = {
  /**
   * Speak a message aloud to the user.
   * @param {string} message - The text to speak
   * @param {Function} [onEnd] - Optional callback when speech finishes
   */
  speak(message, onEnd) {
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
      // Prevent Chrome from garbage collecting the utterance before onend fires
      window.__speech_utterance = utterance;

      // Dynamic safety timeout based on text length (~10 chars per second + 5s buffer)
      const estimatedMs = (message.length / 10) * 1000 + 5000;
      const maxTimeout = Math.max(estimatedMs, 10000); 

      const safetyTimeout = setTimeout(() => {
        console.warn('[VoiceFeedback] TTS onend timeout triggered.');
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

    window.speechSynthesis.speak(utterance);
  },

  /** Stop any ongoing speech. */
  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};
