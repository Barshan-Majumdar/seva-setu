import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * Play a friendly, instant two-tone acoustic chime via Web Audio API.
 * Provides immediate physical confirmation (<10ms) that wake word or voice was activated.
 */
export function playWakeChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Tone 1: 520 Hz (C5) for 100ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tone 2: 780 Hz (G5) for 150ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(780, now + 0.09);
    gain2.gain.setValueAtTime(0.25, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.26);
  } catch (_) {}
}

// Pre-load and cache available voices on web
let cachedVoices = [];
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (Array.isArray(v) && v.length > 0) {
        cachedVoices = v;
      }
    } catch (_) {}
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/**
 * VoiceFeedback — Text-to-Speech service for SevaSetu voice replies.
 * Uses Capacitor Native TTS on Mobile, and Browser Speech Synthesis on Web.
 */
export const VoiceFeedback = {
  playWakeChime,

  /**
   * Speak a message aloud to the user.
   * @param {string} message - The text to speak
   * @param {Function} [onEnd] - Optional callback when speech finishes
   */
  async speak(message, onEnd) {
    if (!message || typeof message !== 'string') {
      if (onEnd) onEnd();
      return;
    }

    console.log('[VoiceFeedback] 🔊 Requested to speak:', message);

    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.stop().catch(() => {});
        await TextToSpeech.speak({
          text: message,
          lang: 'en-IN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient', 
        });
        if (onEnd) onEnd();
      } catch (err) {
        console.error('[VoiceFeedback] Native TTS Error:', err);
        if (onEnd) onEnd();
      }
      return;
    }

    // --- Web Speech Synthesis ---
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[VoiceFeedback] Speech Synthesis not supported in this browser.');
      if (onEnd) onEnd();
      return;
    }

    try {
      // If currently speaking, cancel and allow a tiny 50ms tick for Chrome cancel IPC to settle
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        await new Promise((r) => setTimeout(r, 60));
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick the best available voice
    let voiceToUse = null;
    const voices = (cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices()) || [];
    if (voices.length > 0) {
      voiceToUse = voices.find(v => v.lang === 'en-IN' || v.lang === 'en_IN')
                || voices.find(v => v.lang.startsWith('en-'))
                || voices.find(v => v.lang.startsWith('en'))
                || voices[0];
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang || 'en-US';
      console.log(`[VoiceFeedback] Using voice: ${voiceToUse.name} (${utterance.lang})`);
    } else {
      utterance.lang = 'en-US';
    }

    let hasResolved = false;
    const finish = () => {
      if (hasResolved) return;
      hasResolved = true;
      console.log('[VoiceFeedback] 🏁 Speech finished.');
      if (onEnd) onEnd();
    };

    // Safety fallback: allow ample time for speech based on text length (min 4s)
    const durationEstimateMs = Math.max(4000, (message.length / 10) * 1000 + 1500);
    const safetyTimer = setTimeout(() => {
      console.warn('[VoiceFeedback] Safety timer expired before onend.');
      finish();
    }, durationEstimateMs);

    utterance.onend = () => {
      clearTimeout(safetyTimer);
      finish();
    };

    utterance.onerror = (e) => {
      clearTimeout(safetyTimer);
      console.warn('[VoiceFeedback] Speech error event:', e?.error || e);
      finish();
    };

    // Anchor utterance to prevent Chrome garbage collector prematurely destroying it
    window.__currentSpeechUtterance = utterance;

    try {
      window.speechSynthesis.speak(utterance);
      // Double check Chrome didn't immediately pause synthesis
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.error('[VoiceFeedback] Speak exception:', e);
      clearTimeout(safetyTimer);
      finish();
    }
  },

  /** Check if currently speaking */
  isSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return !!window.speechSynthesis.speaking;
    }
    return false;
  },

  /** Stop any ongoing speech. */
  async stop() {
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.stop().catch(() => {});
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }
};
