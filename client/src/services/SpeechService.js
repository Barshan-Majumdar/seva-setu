import { voiceController, VoiceState } from '../voice/VoiceController';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition';

/**
 * SpeechService — Legacy bridge delegating to VoiceController singleton.
 * Maintains API compatibility while ensuring VoiceController is the SOLE owner of STT.
 */
export class SpeechService {
  constructor() {
    this._unsubscribe = null;
    this._onWakeWord = null;
    this._onTranscript = null;
    this._onPartialTranscript = null;
    this._onError = null;
  }

  get isSupported() {
    if (Capacitor.isNativePlatform()) return true;
    return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  get isListening() {
    return voiceController.getSnapshot().isListening;
  }

  async anchorMicrophoneStream() {
    return await voiceController.unlockAudio();
  }

  pause() {
    voiceController.disarm();
  }

  resume() {
    voiceController.arm();
  }

  async start(onWakeWordCb, onTranscriptCb, onErrorCb, onEndCb = null, onPartialTranscriptCb = null) {
    this._onWakeWord = onWakeWordCb;
    this._onTranscript = onTranscriptCb;
    this._onError = onErrorCb;
    this._onPartialTranscript = onPartialTranscriptCb;

    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = voiceController.subscribe((snap) => {
      if (snap.state === VoiceState.TRIGGERED && this._onWakeWord) {
        this._onWakeWord(snap.transcript);
      }
      if (snap.partialTranscript && this._onPartialTranscript) {
        this._onPartialTranscript(snap.partialTranscript);
      }
      if (snap.transcript && this._onTranscript && snap.state === VoiceState.EXTRACTING) {
        this._onTranscript(snap.transcript);
      }
      if (snap.error && this._onError) {
        this._onError(snap.error);
      }
    });

    if (onTranscriptCb) {
      voiceController.triggerEmergencySession('MANUAL_START');
    } else {
      voiceController.arm();
    }
  }

  async stop() {
    voiceController.disarm();
  }

  commitCurrentSpeech() {
    const snap = voiceController.getSnapshot();
    if (snap.partialTranscript) {
      voiceController.commitUserTurn(snap.partialTranscript);
    }
  }

  async checkPermissions() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { speechRecognition } = await NativeSpeechRecognition.checkPermissions();
        return speechRecognition === 'granted';
      } catch (_) {
        return false;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const res = await navigator.permissions.query({ name: 'microphone' });
        return res.state === 'granted';
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

export const speechService = new SpeechService();
