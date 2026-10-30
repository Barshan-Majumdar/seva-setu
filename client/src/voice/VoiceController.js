/**
 * VoiceController — Single Deterministic Voice Assistant Architecture for SevaSetu
 * 
 * Rules:
 *  1. SINGLE OWNER: Exactly ONE speech recognition instance and ONE TTS stream at any time.
 *  2. HALF-DUPLEX: STT is unconditionally stopped while TTS speaks, plus a 250ms acoustic guard.
 *  3. EXPLICIT FSM: OFF -> ARMING -> ARMED_LISTENING_FOR_WAKE -> TRIGGERED -> PROMPTING -> LISTENING_USER -> EXTRACTING -> CONFIRMING -> STAY_ON_LINE.
 *  4. GENERATION MUTEX: Every state change increments `_generation`. Stale timers or callbacks abort.
 *  5. SOS FIRST, NLP SECOND: Minimum SOS is stored locally and sent to /api/emergency/trigger before waiting for NLP.
 */

import { Capacitor } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import { EmergencyManager } from '../services/EmergencyManager.js';
import { t, getLocale } from './i18n.js';

export const VoiceState = {
  OFF: 'OFF',
  ARMING: 'ARMING',
  ARMED_LISTENING_FOR_WAKE: 'ARMED_LISTENING_FOR_WAKE',
  TRIGGERED: 'TRIGGERED',
  PROMPTING: 'PROMPTING',
  LISTENING_USER: 'LISTENING_USER',
  EXTRACTING: 'EXTRACTING',
  CONFIRMING: 'CONFIRMING',
  STAY_ON_LINE: 'STAY_ON_LINE'
};

const WAKE_WORDS = [
  'sevasetu', 'sevashitu', 'sebasetu', 'shevasetu', 'shivasetu', 'sivasetu',
  'sevasethu', 'sebasethu', 'shevasethu', 'heysevasetu', 'hisevasetu', 'oksevasetu',
  'heyseva', 'hiseva', 'saveasatu', 'saveasetu', 'servicesetu', 'sayvasetu',
  'sevaset', 'sebaset', 'heysheba', 'shebasetu', 'saywasetu', 'sewasetu',
  'sevasatu', 'sevashitu', 'shevashitu', 'sayvaseto', 'saybasetu',
  'servicesethu', 'heyseba', 'heysheba', 'heysewa', 'heysebasetu', 'heyshebasetu',
  'sevaseeto', 'sevaseetu', 'sevaseto', 'sevasitoo', 'sevasitu', 'sebasitu',
  'sevashito', 'sebaseto', 'seversetu'
];

class VoiceController {
  constructor() {
    this._state = VoiceState.OFF;
    this._generation = 0;
    this._listeners = new Set();

    // Data payload
    this._transcript = '';
    this._partialTranscript = '';
    this._systemReply = '';
    this._clientEventId = null;
    this._emergencyData = null;
    this._error = null;
    this._audioLevel = 0.0;
    this._isUnlocked = false;
    this._locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';

    // Adapters & audio hardware handles
    this._recognition = null;
    this._audioContext = null;
    this._analyser = null;
    this._mediaStream = null;
    this._silenceTimer = null;
    this._restartTimer = null;
    this._backoffMs = 500;
    this._currentTurnText = '';
    this._cachedVoices = [];

    // Pre-cache voices and set up global gesture unlock
    if (typeof window !== 'undefined') {
      const unlockEvents = ['click', 'keydown', 'touchstart', 'pointerdown'];
      const onInitialGesture = () => {
        this.unlockAudio();
        unlockEvents.forEach(e => window.removeEventListener(e, onInitialGesture, { capture: true }));
      };
      unlockEvents.forEach(e => window.addEventListener(e, onInitialGesture, { capture: true, passive: true }));

      window.addEventListener('sevasetu:voice-form-opened', () => {
        console.log('[VoiceController] Voice form opened — disarming background listener.');
        this.disarm();
      });
      window.addEventListener('sevasetu:voice-form-closed', () => {
        console.log('[VoiceController] Voice form closed — re-arming background listener.');
        this.arm();
      });

      if (window.speechSynthesis) {
        const loadVoices = () => {
          try {
            const v = window.speechSynthesis.getVoices();
            if (Array.isArray(v) && v.length > 0) this._cachedVoices = v;
          } catch (_) {}
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  static getInstance() {
    if (!VoiceController._instance) {
      VoiceController._instance = new VoiceController();
    }
    return VoiceController._instance;
  }

  // ─────────────────────────────────────────────────────────────
  // Observer Subscription
  // ─────────────────────────────────────────────────────────────
  subscribe(callback) {
    this._listeners.add(callback);
    callback(this.getSnapshot());
    return () => {
      this._listeners.delete(callback);
    };
  }

  _notify() {
    const snap = this.getSnapshot();
    for (const listener of this._listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.error('[VoiceController] Error in subscriber listener:', err);
      }
    }
  }

  getSnapshot() {
    return {
      state: this._state,
      generation: this._generation,
      transcript: this._transcript,
      partialTranscript: this._partialTranscript,
      systemReply: this._systemReply,
      clientEventId: this._clientEventId,
      emergencyData: this._emergencyData,
      error: this._error,
      audioLevel: this._audioLevel,
      isUnlocked: this._isUnlocked,
      locale: this._locale,
      isListening: this._state === VoiceState.ARMED_LISTENING_FOR_WAKE || this._state === VoiceState.LISTENING_USER,
      isSpeaking: this._state === VoiceState.PROMPTING || this._state === VoiceState.CONFIRMING
    };
  }

  // ─────────────────────────────────────────────────────────────
  // State Transitions & Mutex
  // ─────────────────────────────────────────────────────────────
  _transition(nextState, details = {}) {
    this._generation++;
    const prev = this._state;
    this._state = nextState;

    if (details.error !== undefined) this._error = details.error;
    if (details.transcript !== undefined) this._transcript = details.transcript;
    if (details.partialTranscript !== undefined) this._partialTranscript = details.partialTranscript;
    if (details.systemReply !== undefined) this._systemReply = details.systemReply;
    if (details.clientEventId !== undefined) this._clientEventId = details.clientEventId;
    if (details.emergencyData !== undefined) this._emergencyData = details.emergencyData;

    console.log(`[VoiceController] [FSM] ${prev} -> ${nextState} (gen: ${this._generation})`, details);
    this._notify();
    return this._generation;
  }

  // ─────────────────────────────────────────────────────────────
  // Audio Context & User Gesture Unlocking
  // ─────────────────────────────────────────────────────────────
  unlockAudio() {
    if (this._isUnlocked) return Promise.resolve(true);
    console.log('[VoiceController] 🔓 Unlocking AudioContext & SpeechSynthesis...');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this._audioContext) {
          this._audioContext = new AudioCtx();
        }
        if (this._audioContext.state === 'suspended') {
          this._audioContext.resume().then(() => {
            this._isUnlocked = true;
            this._notify();
          }).catch(() => {});
        } else if (this._audioContext.state === 'running') {
          this._isUnlocked = true;
        }
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }

      return Promise.resolve(this._isUnlocked);
    } catch (e) {
      console.warn('[VoiceController] Audio unlock deferred:', e);
      return Promise.resolve(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Acoustic Feedback: Two-Tone Wake Chime (<10ms instant ACK)
  // ─────────────────────────────────────────────────────────────
  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this._audioContext) this._audioContext = new AudioCtx();
      if (this._audioContext.state === 'suspended') {
        this._audioContext.resume().catch(() => {});
      }

      const now = this._audioContext.currentTime;
      // Tone 1: 520Hz (C5) 120ms
      const osc1 = this._audioContext.createOscillator();
      const g1 = this._audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(520, now);
      g1.gain.setValueAtTime(0.2, now);
      g1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(g1);
      g1.connect(this._audioContext.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Tone 2: 780Hz (G5) 160ms
      const osc2 = this._audioContext.createOscillator();
      const g2 = this._audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(780, now + 0.09);
      g2.gain.setValueAtTime(0.25, now + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc2.connect(g2);
      g2.connect(this._audioContext.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.25);
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────
  // Speech-to-Text: Pure Single-Owner Recognition Engine
  // ─────────────────────────────────────────────────────────────
  _stopRecognition() {
    clearTimeout(this._silenceTimer);
    clearTimeout(this._restartTimer);
    this._audioLevel = 0.0;

    if (this._recognition) {
      try {
        const r = this._recognition;
        this._recognition = null;
        r.onstart = null;
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.abort();
      } catch (_) {}
    }
  }

  _startRecognition(expectedState) {
    if (this._state !== expectedState) return;
    this._stopRecognition();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this._transition(VoiceState.OFF, { error: 'Web Speech API not supported in this browser' });
      return;
    }

    const currentGen = this._generation;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this._locale || 'en-IN';

      rec.onstart = () => {
        if (this._generation !== currentGen) return;
        this._backoffMs = 500;
        console.log(`[VoiceController] 🎙️ Mic active in state: ${this._state}`);
        this._notify();
      };

      rec.onresult = (event) => {
        if (this._generation !== currentGen) return;

        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            sessionFinal += res[0].transcript + ' ';
          } else {
            sessionInterim += res[0].transcript;
          }
        }

        const fullPhrase = (sessionFinal.trim() + ' ' + sessionInterim.trim()).trim();
        this._handleSpeechResult(fullPhrase, currentGen);
      };

      rec.onerror = (event) => {
        const err = event?.error;
        console.warn(`[VoiceController] STT Error: ${err} in state: ${this._state}`);

        if (err === 'no-speech' || err === 'aborted') {
          return; // benign
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this._stopRecognition();
          this._transition(VoiceState.OFF, { error: 'Microphone permission denied' });
          return;
        }

        if (err === 'network' || err === 'audio-capture' || err === 'language-not-supported') {
          this._backoffMs = Math.min(this._backoffMs * 1.5, 4000);
        }
      };

      rec.onend = () => {
        if (this._generation !== currentGen) return;
        this._recognition = null;

        // Auto-restart if we should still be listening
        if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE || this._state === VoiceState.LISTENING_USER) {
          clearTimeout(this._restartTimer);
          this._restartTimer = setTimeout(() => {
            if (this._generation === currentGen) {
              this._startRecognition(this._state);
            }
          }, this._backoffMs);
        }
      };

      this._recognition = rec;
      rec.start();
    } catch (err) {
      console.warn('[VoiceController] Failed to start recognition:', err);
      clearTimeout(this._restartTimer);
      this._restartTimer = setTimeout(() => {
        if (this._generation === currentGen) {
          this._startRecognition(expectedState);
        }
      }, 1000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Speech Result Processing: Wake-Word & Turn Commitment
  // ─────────────────────────────────────────────────────────────
  _isWakeWord(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    const clean = lower.replace(/[^a-z0-9]/g, '');

    if (WAKE_WORDS.some(kw => clean.includes(kw))) return true;

    // Pattern matching: "hey seva setu", "seva setu", "hey seba", "seva"
    if (/\b(?:hey|hi|hello|ok|okay|ay|oye)?\s*(?:seva|sewa|seba|sheba|sheva|sayva|saver|sever)\s+(?:setu|sethu|seeto|setoo|shetu|situ|to|2)\b/i.test(lower)) {
      return true;
    }
    if (/\b(?:hey|hi|hello|ok)\s+(?:seva|seba|sheba|sewa)\b/i.test(lower)) {
      return true;
    }
    if (/\b(?:seva|seba|sheva)\s+(?:setu|sethu|situ|seeto)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  _stripWakePrefix(text) {
    if (!text) return '';
    let trailing = text.trim();
    const wakeStripRegex = /^(?:hey|hi|hello|ok|okay|ay|oye)?\s*(?:seva|sewa|siva|shiva|seba|sheba|sheva|sayva|save\s*a|saver|shoba|shubha)\s*(?:setu|sethu|setoo|seeto|sitoo|situ|shetu|chetu|sitoo|said\s*to|say\s*to|stay\s*to|set|to|2|c2)?\b[,.]?\s*/i;
    trailing = trailing.replace(wakeStripRegex, '').trim();
    return trailing;
  }

  _handleSpeechResult(phrase, gen) {
    if (this._generation !== gen || !phrase) return;

    // Mode 1: Listening for Wake Word ("Hey SevaSetu")
    if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) {
      if (this._isWakeWord(phrase)) {
        console.log('[VoiceController] 🎯 Wake word detected:', phrase);
        const trailingSpeech = this._stripWakePrefix(phrase);
        this.triggerEmergencySession('VOICE_WAKE', trailingSpeech);
      }
      return;
    }

    // Mode 2: Actively Listening to User Emergency Details
    if (this._state === VoiceState.LISTENING_USER) {
      this._partialTranscript = phrase;
      this._currentTurnText = phrase;
      this._notify();

      // Silence-based end-of-utterance commitment (1800ms natural breathing space)
      clearTimeout(this._silenceTimer);
      this._silenceTimer = setTimeout(() => {
        if (this._generation === gen && this._currentTurnText) {
          console.log('[VoiceController] ⏱️ Silence detected. Committing full user turn:', this._currentTurnText);
          const finalTurn = this._currentTurnText;
          this._currentTurnText = '';
          this.commitUserTurn(finalTurn);
        }
      }, 1800);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Text-To-Speech: Half-Duplex Guaranteed
  // ─────────────────────────────────────────────────────────────
  async _speakHalfDuplex(text) {
    const currentGen = this._generation;

    // 1. Unconditionally stop STT so the assistant never hears itself
    this._stopRecognition();

    console.log(`[VoiceController] 🔊 Half-duplex TTS Speaking: "${text}"`);

    if (Capacitor.isNativePlatform()) {
      try {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop().catch(() => {});
        await TextToSpeech.speak({
          text,
          lang: this._locale || 'en-IN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
      } catch (err) {
        console.warn('[VoiceController] Native TTS error:', err);
      }
    } else {
      // Browser Web Speech Synthesis
      await new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          return resolve();
        }

        try {
          window.speechSynthesis.cancel();
        } catch (_) {}

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = this._cachedVoices.length > 0 ? this._cachedVoices : window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang === this._locale || v.lang === 'en-IN')
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];

        if (preferred) {
          utterance.voice = preferred;
          utterance.lang = preferred.lang || 'en-US';
        }

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          resolve();
        };

        utterance.onend = done;
        utterance.onerror = done;

        // Safety timeout so speech never hangs the state machine
        const durationEstimate = Math.max(2500, (text.length / 10) * 1000 + 1000);
        setTimeout(done, durationEstimate);

        window.__currentVoiceUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      });
    }

    if (this._generation !== currentGen) return;

    // 2. Mandatory 250ms Acoustic Guard Time before audio hardware reopens
    console.log('[VoiceController] 🛡️ 250ms acoustic guard time settling...');
    await new Promise((r) => setTimeout(r, 250));
  }

  // ─────────────────────────────────────────────────────────────
  // Public Lifecycle & Commands
  // ─────────────────────────────────────────────────────────────

  /**
   * Arm the assistant into passive wake-word detection
   */
  arm() {
    if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) return;
    this.unlockAudio();
    this._transition(VoiceState.ARMED_LISTENING_FOR_WAKE, { error: null });
    this._startRecognition(VoiceState.ARMED_LISTENING_FOR_WAKE);
  }

  /**
   * Turn assistant completely off
   */
  disarm() {
    this._stopRecognition();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    this._transition(VoiceState.OFF, {
      transcript: '',
      partialTranscript: '',
      systemReply: '',
      error: null
    });
  }

  /**
   * Core Entry Point: User says "Hey SevaSetu" OR clicks voice emergency button
   * Golden Law: Creates local minimum SOS & triggers API BEFORE awaiting NLP.
   */
  async triggerEmergencySession(triggerType = 'VOICE_WAKE', initialTranscript = '') {
    this.unlockAudio();
    this.playChime();

    // 1. Create clientEventId & save Minimum SOS locally and remotely FIRST
    const clientEventId = uuidv4();
    this._clientEventId = clientEventId;
    this._transcript = initialTranscript;
    this._partialTranscript = '';

    this._transition(VoiceState.TRIGGERED, {
      clientEventId,
      transcript: initialTranscript,
      error: null
    });

    console.log('[VoiceController] 🚨 Minimum SOS creation initiated:', clientEventId);
    EmergencyManager.triggerEmergency(triggerType).catch(err => {
      console.warn('[VoiceController] Minimum SOS non-blocking trigger notice:', err);
    });

    // 2. Speak greeting prompt aloud
    const promptText = t('greeting', this._locale);
    const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: promptText });
    await this._speakHalfDuplex(promptText);

    if (this._generation !== promptGen) return;

    // 3. If the user already gave their emergency details alongside the wake word:
    if (initialTranscript && initialTranscript.length > 8) {
      this.commitUserTurn(initialTranscript);
      return;
    }

    // 4. Otherwise, enter active listening for user description
    console.log('[VoiceController] 🎙️ Opening microphone for user response...');
    this._transition(VoiceState.LISTENING_USER, { systemReply: '' });
    this._startRecognition(VoiceState.LISTENING_USER);
  }

  /**
   * Manual commit or silence commit of user's utterance
   */
  async commitUserTurn(spokenText) {
    if (!spokenText || !spokenText.trim()) return;
    const extractGen = this._transition(VoiceState.EXTRACTING, {
      transcript: spokenText,
      partialTranscript: spokenText
    });
    this._stopRecognition();

    try {
      const AI_URL = import.meta?.env?.VITE_AI_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${AI_URL}/extract-facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: spokenText,
          language: this._locale || 'en-IN'
        })
      });

      if (!aiResponse.ok) {
        throw new Error(`AI returned HTTP ${aiResponse.status}`);
      }

      const nlpResult = await aiResponse.json();
      console.log('[VoiceController] NLP Analysis:', nlpResult);

      if (this._generation !== extractGen) return;

      const intent = (nlpResult.intent || 'UNKNOWN').toUpperCase();
      const reply = nlpResult.reply || 'Understood.';

      // Case A: User indicates safe / cancel
      if (intent === 'SAFE' || intent === 'CANCEL') {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        this.arm();
        return;
      }

      // Case B: User asking who you are / what is SevaSetu
      if (intent === 'INFO') {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        // Continue listening for emergency
        this._transition(VoiceState.LISTENING_USER);
        this._startRecognition(VoiceState.LISTENING_USER);
        return;
      }

      // Case C: User says yes / needs to give details
      if (intent === 'QUERY_DETAILS' && !nlpResult.isEmergency) {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        this._transition(VoiceState.LISTENING_USER);
        this._startRecognition(VoiceState.LISTENING_USER);
        return;
      }

      // Case D: Confirmed Emergency (or fallback emergency)
      // Forward facts to Node server with location
      const loc = await EmergencyManager.getBestAvailableLocation().catch(() => null);
      await EmergencyManager.enrichEmergencyWithVoice(this._clientEventId, spokenText, loc);

      const confirmGen = this._transition(VoiceState.CONFIRMING, {
        emergencyData: nlpResult,
        systemReply: reply
      });
      await this._speakHalfDuplex(reply);

      if (this._generation !== confirmGen) return;
      this._transition(VoiceState.STAY_ON_LINE);

    } catch (err) {
      console.warn('[VoiceController] NLP extract error, falling back to emergency dispatch:', err);
      // Golden Law: In case of AI failure, emergency is STILL preserved & acknowledged!
      const fallbackAck = t('emergencyAck', this._locale);
      const fallbackGen = this._transition(VoiceState.CONFIRMING, { systemReply: fallbackAck });
      await this._speakHalfDuplex(fallbackAck);

      if (this._generation !== fallbackGen) return;
      this._transition(VoiceState.STAY_ON_LINE);
    }
  }

  /**
   * Cancel or close the current active session
   */
  cancelSession() {
    console.log('[VoiceController] Cancelling active session...');
    this.arm();
  }
}

export const voiceController = VoiceController.getInstance();
