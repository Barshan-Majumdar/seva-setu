/**
 * VoiceController — Single Deterministic Voice Assistant Architecture for SevaSetu
 * 
 * Rules:
 *  1. SINGLE OWNER: Exactly ONE speech recognition instance, ONE PCM WAV recorder, and ONE TTS stream.
 *  2. HALF-DUPLEX: STT & audio recording are unconditionally stopped while TTS speaks, plus 250ms acoustic guard.
 *  3. DUAL-ENGINE STT:
 *     - Engine A: Web Speech API (streaming partials in Chrome where cloud speech works)
 *     - Engine B: Local Whisper PCM WAV Engine (100% offline, deterministic, records voice as 16-bit WAV
 *                 and transcribes locally on port 8000. Resolves Chrome cloud Web Speech failures completely.)
 *  4. EXPLICIT FSM: OFF -> ARMING -> ARMED_LISTENING_FOR_WAKE -> TRIGGERED -> PROMPTING -> LISTENING_USER -> EXTRACTING -> CONFIRMING -> STAY_ON_LINE.
 *  5. SOS FIRST, NLP SECOND: Minimum SOS stored locally and sent to /api/emergency/trigger before waiting for NLP.
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

/**
 * Encodes raw Float32Array PCM chunks into a valid 16-bit mono RIFF WAV Blob.
 * Preserves the browser's native sample rate so FFmpeg/Whisper resamples with sinc precision.
 */
function pcmToWavBlob(chunks, sampleRate = 44100) {
  let totalSamples = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalSamples += chunks[i].length;
  }
  if (totalSamples === 0) return null;

  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].length;
  }

  const wavBuffer = new ArrayBuffer(44 + merged.length * 2);
  const view = new DataView(wavBuffer);

  const writeStr = (pos, str) => {
    for (let j = 0; j < str.length; j++) {
      view.setUint8(pos + j, str.charCodeAt(j));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + merged.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format (1)
  view.setUint16(22, 1, true); // Mono channel (1)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16 bits per sample
  writeStr(36, 'data');
  view.setUint32(40, merged.length * 2, true);

  let byteOffset = 44;
  for (let i = 0; i < merged.length; i++, byteOffset += 2) {
    const s = Math.max(-1, Math.min(1, merged[i]));
    view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

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
    this._sessionId = 0;
    this._isStarting = false;
    this._isRecognitionActive = false;
    this._sessionStartTime = 0;
    this._silenceTimer = null;
    this._restartTimer = null;
    this._backoffMs = 500;
    this._currentTurnText = '';
    this._cachedVoices = [];

    // Audio monitor & PCM WAV recording handles
    this._monitorStream = null;
    this._monitorCtx = null;
    this._monitorSource = null;
    this._monitorAnalyser = null;
    this._recorderNode = null;
    this._muteGain = null;
    this._monitorAnimFrame = null;
    this._monitorPeakLevel = 0;
    this._silentMicWarned = false;
    this._selectedDeviceId = null;

    // VAD & PCM buffer state
    this._pcmChunks = [];
    this._isRecordingAudio = false;
    this._isTranscribing = false;
    this._vadSpeechActive = false;
    this._speechStartTime = 0;
    this._lastSpeechTime = 0;

    // Silence nudge tracking for LISTENING_USER
    this._silenceNudgeCount = 0;
    this._silenceNudgeTimer = null;

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

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE && !this._isRecognitionActive && !this._isStarting) {
            console.log('[VoiceController] Tab visible again — re-starting recognition.');
            this._startRecognition(VoiceState.ARMED_LISTENING_FOR_WAKE);
          }
        }
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
      isListening: (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE || this._state === VoiceState.LISTENING_USER) && !this._isTranscribing,
      isTranscribing: this._isTranscribing,
      isSpeaking: this._state === VoiceState.PROMPTING || this._state === VoiceState.CONFIRMING,
      monitorPeakLevel: this._monitorPeakLevel,
      silentMicWarning: this._silentMicWarned,
    };
  }

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

  async unlockAudio() {
    if (this._isUnlocked && this._monitorStream) return true;
    console.log('[VoiceController] 🔓 Unlocking AudioContext, Mic & SpeechSynthesis...');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this._monitorCtx) {
          this._monitorCtx = new AudioCtx();
        }
        if (this._monitorCtx.state === 'suspended') {
          await this._monitorCtx.resume().catch(() => {});
        }
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }

      await this._startAudioMonitor();

      this._isUnlocked = true;
      this._notify();
      return true;
    } catch (e) {
      console.warn('[VoiceController] Audio unlock deferred:', e);
      return false;
    }
  }

  async _startAudioMonitor() {
    if (this._monitorStream && this._monitorStream.active) return;

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      if (this._selectedDeviceId) {
        constraints.audio.deviceId = { exact: this._selectedDeviceId };
      }

      this._monitorStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this._monitorCtx || this._monitorCtx.state === 'closed') {
        this._monitorCtx = new AudioCtx();
      }
      if (this._monitorCtx.state === 'suspended') {
        await this._monitorCtx.resume();
      }

      this._monitorAnalyser = this._monitorCtx.createAnalyser();
      this._monitorAnalyser.fftSize = 256;
      this._monitorSource = this._monitorCtx.createMediaStreamSource(this._monitorStream);
      this._monitorSource.connect(this._monitorAnalyser);

      // Create pure PCM recording node (4096 buffer size, 1 channel)
      this._pcmChunks = [];
      if (!this._recorderNode) {
        this._recorderNode = this._monitorCtx.createScriptProcessor(4096, 1, 1);
        this._recorderNode.onaudioprocess = (e) => {
          if (this._isRecordingAudio) {
            const inputData = e.inputBuffer.getChannelData(0);
            this._pcmChunks.push(new Float32Array(inputData));
          }
        };
        // Connect to a 0-gain node to prevent microphone audio leaking through speakers
        this._muteGain = this._monitorCtx.createGain();
        this._muteGain.gain.value = 0;
        this._monitorSource.connect(this._recorderNode);
        this._recorderNode.connect(this._muteGain);
        this._muteGain.connect(this._monitorCtx.destination);
      }

      const data = new Uint8Array(this._monitorAnalyser.frequencyBinCount);
      this._monitorPeakLevel = 0;
      this._silentMicWarned = false;
      let sampleCount = 0;

      const poll = () => {
        if (!this._monitorAnalyser) return;
        this._monitorAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;

        this._audioLevel = avg;
        if (avg > this._monitorPeakLevel) this._monitorPeakLevel = avg;

        sampleCount++;

        if (sampleCount % 4 === 0) {
          this._notify();
        }

        // ── VAD Processing in LISTENING_USER & STAY_ON_LINE states ──
        if ((this._state === VoiceState.LISTENING_USER || this._state === VoiceState.STAY_ON_LINE) && this._isRecordingAudio && !this._isTranscribing) {
          const now = Date.now();
          const SPEECH_THRESHOLD = 5.0;

          if (avg > SPEECH_THRESHOLD) {
            this._lastSpeechTime = now;
            if (!this._vadSpeechActive) {
              if (!this._speechStartTime) {
                this._speechStartTime = now;
              } else if (now - this._speechStartTime >= 100) {
                this._vadSpeechActive = true;
                console.log('[VoiceController] 🗣️ User speech onset detected');
                this._setupSilenceNudge();
              }
            }
          } else {
            if (this._vadSpeechActive) {
              const silenceDuration = now - this._lastSpeechTime;
              const totalSpeechDuration = this._lastSpeechTime - this._speechStartTime;

              // Smart adaptive silence threshold:
              // - Long complete sentences (>= 1800ms speech): 950ms silence is sufficient to detect completion.
              // - Standard speech (700ms - 1800ms): 1100ms silence.
              // - Short utterances (< 700ms): 1300ms silence to prevent cutting off early pauses.
              let requiredSilence = 1100;
              if (totalSpeechDuration >= 1800) {
                requiredSilence = 950;
              } else if (totalSpeechDuration < 700) {
                requiredSilence = 1300;
              }

              if ((totalSpeechDuration >= 400 && silenceDuration >= requiredSilence) || (now - this._speechStartTime >= 14000)) {
                console.log(`[VoiceController] ⏱️ VAD: Sentence boundary reached (Spoke: ${totalSpeechDuration}ms, Silence: ${silenceDuration}ms >= ${requiredSilence}ms). Transcribing...`);
                this._stopVADAndTranscribe();
              }
            }
          }
        }

        // ── VAD Processing in ARMED_LISTENING_FOR_WAKE state ──
        if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE && this._isRecordingAudio && !this._isTranscribing) {
          const now = Date.now();
          if (avg > 6.0) {
            this._lastSpeechTime = now;
            if (!this._vadSpeechActive) {
              if (!this._speechStartTime) {
                this._speechStartTime = now;
              } else if (now - this._speechStartTime >= 100) {
                this._vadSpeechActive = true;
              }
            }
          } else {
            if (this._vadSpeechActive) {
              const silenceDuration = now - this._lastSpeechTime;
              const speechDuration = this._lastSpeechTime - this._speechStartTime;
              // Snappy wake silence: 380ms silence after wake utterance triggers Whisper immediately (reduced from 1200ms)
              if ((speechDuration >= 200 && silenceDuration >= 380) || (now - this._speechStartTime >= 5000)) {
                console.log(`[VoiceController] ⏱️ VAD: Wake speech phrase ended (Spoke: ${speechDuration}ms, Silence: ${silenceDuration}ms). Checking wake word...`);
                this._checkWakeWordViaWhisper();
              }
            }
          }
        }

        this._monitorAnimFrame = requestAnimationFrame(poll);
      };
      poll();

      const tracks = this._monitorStream.getAudioTracks();
      const label = tracks[0]?.label || 'Microphone';
      console.log(`[VoiceController] 🔍 PCM Mic monitor active on: "${label}"`);

    } catch (err) {
      console.warn('[VoiceController] Audio monitor notice:', err.message);
    }
  }

  _stopAudioMonitor() {
    if (this._monitorAnimFrame) {
      cancelAnimationFrame(this._monitorAnimFrame);
      this._monitorAnimFrame = null;
    }
    if (this._monitorStream) {
      this._monitorStream.getTracks().forEach(t => t.stop());
      this._monitorStream = null;
    }
    this._monitorAnalyser = null;
    this._audioLevel = 0;
  }

  // ─────────────────────────────────────────────────────────────
  // VAD PCM WAV Engine (Local Whisper STT)
  // ─────────────────────────────────────────────────────────────
  _startVADRecording() {
    if (!this._monitorStream || !this._monitorStream.active) {
      this._startAudioMonitor().then(() => this._startVADRecording());
      return;
    }

    this._pcmChunks = [];
    this._isRecordingAudio = true;
    this._isTranscribing = false;
    this._vadSpeechActive = false;
    this._speechStartTime = 0;
    this._lastSpeechTime = 0;
    console.log(`[VoiceController] 🎙️ VAD PCM recording ACTIVE (State: ${this._state})`);
  }

  _stopVADRecording() {
    this._isRecordingAudio = false;
    this._vadSpeechActive = false;
    this._speechStartTime = 0;
    this._lastSpeechTime = 0;
    this._pcmChunks = [];
  }

  finishSpeakingNow() {
    if ((this._state === VoiceState.LISTENING_USER || this._state === VoiceState.STAY_ON_LINE) && this._isRecordingAudio && !this._isTranscribing) {
      console.log('[VoiceController] ⚡ finishSpeakingNow triggered immediately');
      this._stopVADAndTranscribe();
    }
  }

  async _stopVADAndTranscribe() {
    if (!this._isRecordingAudio || this._isTranscribing) return;
    this._isTranscribing = true;
    this._isRecordingAudio = false;
    this._notify();

    // Grab accumulated PCM samples
    const chunks = this._pcmChunks;
    this._pcmChunks = [];

    const sampleRate = (this._monitorCtx && this._monitorCtx.sampleRate) || 44100;
    const wavBlob = pcmToWavBlob(chunks, sampleRate);

    if (!wavBlob || wavBlob.size < 4000) {
      this._isTranscribing = false;
      if (this._state === VoiceState.LISTENING_USER || this._state === VoiceState.STAY_ON_LINE) {
        this._startVADRecording();
      }
      return;
    }

    if (this._state !== VoiceState.LISTENING_USER && this._state !== VoiceState.STAY_ON_LINE) {
      this._isTranscribing = false;
      return;
    }

    this._partialTranscript = 'Transcribing your full sentence...';
    this._notify();

    try {
      const formData = new FormData();
      formData.append('file', wavBlob, 'user_speech.wav');

      const AI_URL = import.meta?.env?.VITE_AI_URL || 'http://localhost:8000';
      const res = await fetch(`${AI_URL}/transcribe`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.text || '').trim();
        console.log(`[VoiceController] 🎯 Local Whisper transcribed WAV: "${text}"`);

        if (text && text.length > 1) {
          this._partialTranscript = text;
          this._transcript = text;
          this._notify();
          this._isTranscribing = false;
          await this.commitUserTurn(text);
          return;
        }
      }
    } catch (err) {
      console.warn('[VoiceController] Whisper transcribe error:', err);
    }

    this._isTranscribing = false;
    if (this._state === VoiceState.LISTENING_USER || this._state === VoiceState.STAY_ON_LINE) {
      this._partialTranscript = '';
      this._notify();
      this._startVADRecording();
    }
  }

  async _checkWakeWordViaWhisper() {
    if (!this._isRecordingAudio || this._isTranscribing) return;
    this._isTranscribing = true;
    this._isRecordingAudio = false;

    const chunks = this._pcmChunks;
    this._pcmChunks = [];

    const sampleRate = (this._monitorCtx && this._monitorCtx.sampleRate) || 44100;
    const wavBlob = pcmToWavBlob(chunks, sampleRate);

    if (!wavBlob || wavBlob.size < 4000) {
      this._isTranscribing = false;
      if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) this._startVADRecording();
      return;
    }

    if (this._state !== VoiceState.ARMED_LISTENING_FOR_WAKE) {
      this._isTranscribing = false;
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', wavBlob, 'wake_snippet.wav');

      const AI_URL = import.meta?.env?.VITE_AI_URL || 'http://localhost:8000';
      const res = await fetch(`${AI_URL}/transcribe`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.text || '').trim();
        console.log(`[VoiceController] 🔍 Wake test Whisper transcript: "${text}"`);

        if (text && this._isWakeWord(text)) {
          console.log('[VoiceController] 🎯 WAKE WORD DETECTED VIA WHISPER:', text);
          this._isTranscribing = false;
          const trailing = this._stripWakePrefix(text);
          this.triggerEmergencySession('VOICE_WAKE', trailing);
          return;
        }
      }
    } catch (err) {
      console.warn('[VoiceController] Wake check error:', err);
    }

    this._isTranscribing = false;
    if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) {
      this._startVADRecording();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Acoustic Feedback: Two-Tone Wake Chime
  // ─────────────────────────────────────────────────────────────
  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = this._monitorCtx || new AudioCtx();
      if (!this._monitorCtx) this._monitorCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(520, now);
      g1.gain.setValueAtTime(0.2, now);
      g1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(g1);
      g1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(780, now + 0.09);
      g2.gain.setValueAtTime(0.25, now + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc2.connect(g2);
      g2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.25);
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────
  // STT: Speech Recognition Engine
  // ─────────────────────────────────────────────────────────────
  _stopRecognition() {
    clearTimeout(this._silenceTimer);
    clearTimeout(this._restartTimer);
    clearTimeout(this._silenceNudgeTimer);
    this._restartTimer = null;
    this._audioLevel = 0.0;
    this._isRecognitionActive = false;
    this._isStarting = false;
    this._stopVADRecording();

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

  async _stopRecognitionAsync() {
    clearTimeout(this._silenceTimer);
    clearTimeout(this._restartTimer);
    clearTimeout(this._silenceNudgeTimer);
    this._restartTimer = null;
    this._audioLevel = 0.0;
    this._isRecognitionActive = false;
    this._isStarting = false;
    this._stopVADRecording();

    if (!this._recognition) return;

    const r = this._recognition;
    this._recognition = null;

    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const safetyTimer = setTimeout(done, 400);

      r.onstart = null;
      r.onresult = null;
      r.onend = () => {
        clearTimeout(safetyTimer);
        done();
      };
      r.onerror = () => {
        clearTimeout(safetyTimer);
        done();
      };

      try {
        r.abort();
      } catch (_) {
        clearTimeout(safetyTimer);
        done();
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async _startRecognition(expectedState) {
    if (this._state !== expectedState) return;

    // Start local PCM WAV recording IMMEDIATELY and UNCONDITIONALLY!
    this._startVADRecording();

    if (this._recognition && this._isRecognitionActive) return;
    if (this._isStarting) return;
    this._isStarting = true;

    if (this._recognition) {
      await this._stopRecognitionAsync();
    }

    if (this._state !== expectedState) {
      this._isStarting = false;
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this._isStarting = false;
      return;
    }

    const sessionId = ++this._sessionId;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this._locale || 'en-US';

      rec.onstart = () => {
        if (this._sessionId !== sessionId) return;
        this._isStarting = false;
        this._isRecognitionActive = true;
        this._sessionStartTime = Date.now();
        this._backoffMs = 500;
        this._notify();
      };

      rec.onresult = (event) => {
        if (this._sessionId !== sessionId) return;
        if (this._state === VoiceState.PROMPTING || this._state === VoiceState.CONFIRMING) return;

        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) sessionFinal += res[0].transcript + ' ';
          else sessionInterim += res[0].transcript;
        }

        const fullPhrase = (sessionFinal.trim() + ' ' + sessionInterim.trim()).trim();
        if (!fullPhrase) return;

        // ⚡ INSTANT WAKE DETECTION: If waiting for wake word, trigger immediately on partial/final speech!
        if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) {
          if (this._isWakeWord(fullPhrase)) {
            console.log('[VoiceController] ⚡ INSTANT WAKE WORD via WebSpeech:', fullPhrase);
            const trailingSpeech = this._stripWakePrefix(fullPhrase);
            this.triggerEmergencySession('VOICE_WAKE', trailingSpeech);
            return;
          }
        }

        // Visual feedback during conversation turns
        this._partialTranscript = fullPhrase;
        this._notify();
      };

      rec.onerror = (e) => {
        if (this._sessionId !== sessionId) return;
        this._isStarting = false;
        this._isRecognitionActive = false;
        this._recognition = null;

        // Auto-restart streaming recognition on transient error so wake listening never dies
        if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE && e?.error !== 'not-allowed') {
          clearTimeout(this._restartTimer);
          this._restartTimer = setTimeout(() => {
            if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE && !this._isRecognitionActive && !this._isStarting) {
              this._startRecognition(VoiceState.ARMED_LISTENING_FOR_WAKE);
            }
          }, 400);
        }
      };

      rec.onend = () => {
        if (this._sessionId !== sessionId) return;
        this._isStarting = false;
        this._isRecognitionActive = false;
        this._recognition = null;

        // Keep wake-word listener alive continuously across browser silence timeouts
        if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) {
          clearTimeout(this._restartTimer);
          this._restartTimer = setTimeout(() => {
            if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE && !this._isRecognitionActive && !this._isStarting) {
              this._startRecognition(VoiceState.ARMED_LISTENING_FOR_WAKE);
            }
          }, 250);
        }
      };

      this._recognition = rec;
      rec.start();

      if (expectedState === VoiceState.LISTENING_USER) {
        this._silenceNudgeCount = 0;
        this._setupSilenceNudge();
      }

    } catch (err) {
      this._isStarting = false;
      this._isRecognitionActive = false;
      this._recognition = null;
    }
  }

  _setupSilenceNudge() {
    clearTimeout(this._silenceNudgeTimer);
    this._silenceNudgeTimer = setTimeout(async () => {
      if (this._state !== VoiceState.LISTENING_USER) return;
      if (this._vadSpeechActive || this._isTranscribing) return;

      this._silenceNudgeCount++;
      if (this._silenceNudgeCount >= 2) {
        if (this._transcript) {
          this.commitUserTurn(this._transcript);
        }
        return;
      }

      const nudgeText = t('silenceNudge', this._locale);
      const nudgeGen = this._transition(VoiceState.PROMPTING, { systemReply: nudgeText });
      await this._speakHalfDuplex(nudgeText);
      if (this._generation !== nudgeGen) return;
      this._transition(VoiceState.LISTENING_USER, { systemReply: '' });
      await this._startRecognition(VoiceState.LISTENING_USER);
      this._setupSilenceNudge();
    }, 8500);
  }

  _isWakeWord(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    const clean = lower.replace(/[^a-z0-9]/g, '');

    if (WAKE_WORDS.some(kw => clean.includes(kw))) return true;

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

  _handleSpeechResult(phrase) {
    if (!phrase || !phrase.trim()) return;

    if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) {
      if (this._isWakeWord(phrase)) {
        console.log('[VoiceController] 🎯 WAKE WORD DETECTED:', phrase);
        const trailingSpeech = this._stripWakePrefix(phrase);
        this.triggerEmergencySession('VOICE_WAKE', trailingSpeech);
      }
      return;
    }

    if (this._state === VoiceState.LISTENING_USER) {
      this._partialTranscript = phrase;
      this._currentTurnText = phrase;
      this._notify();

      this._setupSilenceNudge();

      clearTimeout(this._silenceTimer);
      this._silenceTimer = setTimeout(() => {
        if (this._state === VoiceState.LISTENING_USER && this._currentTurnText) {
          console.log('[VoiceController] ⏱️ WebSpeech turn commitment:', this._currentTurnText);
          const finalTurn = this._currentTurnText;
          this._currentTurnText = '';
          this.commitUserTurn(finalTurn);
        }
      }, 2200);
    }
  }

  async _speakHalfDuplex(text) {
    const currentGen = this._generation;

    await this._stopRecognitionAsync();

    console.log(`[VoiceController] 🔊 TTS Speaking: "${text}"`);

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

        const durationEstimate = Math.max(2500, (text.length / 10) * 1000 + 1000);
        setTimeout(done, durationEstimate);

        window.__currentVoiceUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      });
    }

    if (this._generation !== currentGen) return;

    console.log('[VoiceController] 🛡️ 250ms acoustic guard...');
    await new Promise((r) => setTimeout(r, 250));
  }

  async arm() {
    if (this._state === VoiceState.ARMED_LISTENING_FOR_WAKE) return;
    await this.unlockAudio();
    this._transition(VoiceState.ARMED_LISTENING_FOR_WAKE, { error: null });
    this._startRecognition(VoiceState.ARMED_LISTENING_FOR_WAKE);
  }

  disarm() {
    this._stopRecognition();
    this._stopAudioMonitor();
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

  async triggerEmergencySession(triggerType = 'VOICE_WAKE', initialTranscript = '') {
    await this.unlockAudio();
    this.playChime();

    const clientEventId = uuidv4();
    this._clientEventId = clientEventId;
    this._transcript = initialTranscript;
    this._partialTranscript = '';
    this._currentTurnText = '';

    this._transition(VoiceState.TRIGGERED, {
      clientEventId,
      transcript: initialTranscript,
      error: null
    });

    console.log('[VoiceController] 🚨 Minimum SOS creation initiated:', clientEventId);
    EmergencyManager.triggerEmergency(triggerType).catch(err => {
      console.warn('[VoiceController] Minimum SOS non-blocking trigger notice:', err);
    });

    try {
      const promptText = t('greeting', this._locale);
      const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: promptText });
      await this._speakHalfDuplex(promptText);

      if (this._generation !== promptGen) return;

      if (initialTranscript && initialTranscript.length > 8) {
        this.commitUserTurn(initialTranscript);
        return;
      }

      console.log('[VoiceController] 🎙️ Opening microphone for user response...');
      this._transition(VoiceState.LISTENING_USER, { systemReply: '' });
      await this._startRecognition(VoiceState.LISTENING_USER);
    } catch (err) {
      console.warn('[VoiceController] Error in emergency session turn:', err);
      this._transition(VoiceState.LISTENING_USER, { systemReply: '' });
      await this._startRecognition(VoiceState.LISTENING_USER);
    }
  }

  async commitUserTurn(spokenText) {
    if (!spokenText || !spokenText.trim()) return;
    clearTimeout(this._silenceTimer);
    clearTimeout(this._silenceNudgeTimer);
    
    const extractGen = this._transition(VoiceState.EXTRACTING, {
      transcript: spokenText,
      partialTranscript: spokenText
    });
    await this._stopRecognitionAsync();

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

      if (intent === 'SAFE' || intent === 'CANCEL') {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        this.arm();
        return;
      }

      if (intent === 'INFO') {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        this._partialTranscript = '';
        this._transcript = '';
        this._transition(VoiceState.LISTENING_USER);
        await this._startRecognition(VoiceState.LISTENING_USER);
        return;
      }

      if (intent === 'QUERY_DETAILS' && !nlpResult.isEmergency) {
        const promptGen = this._transition(VoiceState.PROMPTING, { systemReply: reply });
        await this._speakHalfDuplex(reply);
        if (this._generation !== promptGen) return;
        this._partialTranscript = '';
        this._transcript = '';
        this._transition(VoiceState.LISTENING_USER);
        await this._startRecognition(VoiceState.LISTENING_USER);
        return;
      }

      const loc = await EmergencyManager.getBestAvailableLocation().catch(() => null);
      const enrichResult = await EmergencyManager.enrichEmergencyWithVoice(this._clientEventId, spokenText, loc).catch(() => null);

      const confirmGen = this._transition(VoiceState.CONFIRMING, {
        emergencyData: nlpResult,
        systemReply: reply
      });
      await this._speakHalfDuplex(reply);

      if (this._generation !== confirmGen) return;

      // Auto-close session & dismiss popup after confirmation is spoken (+ 2.5s display grace period)
      await new Promise((r) => setTimeout(r, 2500));

      if (this._generation === confirmGen) {
        console.log('[VoiceController] Auto-closing emergency session. Returning to hands-free wake listener.');
        this._partialTranscript = '';
        this._transcript = '';
        this._systemReply = '';
        this.arm(); // Automatically resets state to ARMED_LISTENING_FOR_WAKE, dismissing the modal popup
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sevasetu:emergency-closed', { detail: enrichResult }));
        }
      }

    } catch (err) {
      console.warn('[VoiceController] NLP extract fallback to emergency dispatch:', err);
      const fallbackAck = t('emergencyAck', this._locale);
      const fallbackGen = this._transition(VoiceState.CONFIRMING, { systemReply: fallbackAck });
      await this._speakHalfDuplex(fallbackAck);

      if (this._generation !== fallbackGen) return;

      // Auto-close session & dismiss popup after confirmation (+ 2.5s display grace period)
      await new Promise((r) => setTimeout(r, 2500));
      if (this._generation === fallbackGen) {
        console.log('[VoiceController] Auto-closing fallback emergency session.');
        this._partialTranscript = '';
        this._transcript = '';
        this._systemReply = '';
        this.arm();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sevasetu:emergency-closed'));
        }
      }
    }
  }

  cancelSession() {
    console.log('[VoiceController] Cancelling active session...');
    clearTimeout(this._silenceTimer);
    clearTimeout(this._silenceNudgeTimer);
    this.arm();
  }
}

export const voiceController = VoiceController.getInstance();
