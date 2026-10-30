/**
 * BackgroundVoiceService — Delegated to VoiceController singleton.
 * Maintains API compatibility with legacy calls in App.jsx and native wrappers
 * while guaranteeing that VoiceController is the SOLE owner of speech recognition.
 */
import { voiceController, VoiceState } from '../voice/VoiceController';
import { Capacitor } from '@capacitor/core';
import { nativeSpeechBridge } from './NativeSpeechBridge';

class BackgroundVoiceService {
  constructor() {
    this._onWakeWordDetected = null;
    this._unsubscribe = null;
  }

  async init(onWakeWordDetected) {
    this._onWakeWordDetected = onWakeWordDetected;

    if (Capacitor.isNativePlatform()) {
      return await nativeSpeechBridge.init();
    }

    // Subscribe to VoiceController
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = voiceController.subscribe((snap) => {
      if (snap.state === VoiceState.TRIGGERED && this._onWakeWordDetected) {
        this._onWakeWordDetected(snap.transcript);
      }
    });

    return true;
  }

  async start() {
    if (Capacitor.isNativePlatform()) {
      return await nativeSpeechBridge.startWakeWordListening((t) => {
        if (this._onWakeWordDetected) this._onWakeWordDetected(t);
      });
    }
    voiceController.arm();
  }

  pause() {
    if (Capacitor.isNativePlatform()) {
      nativeSpeechBridge.pause();
    } else {
      voiceController.disarm();
    }
  }

  resume() {
    if (Capacitor.isNativePlatform()) {
      nativeSpeechBridge.resume();
    } else {
      voiceController.arm();
    }
  }

  stop() {
    this.pause();
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.stop();
  }
}

const backgroundVoiceService = new BackgroundVoiceService();
export default backgroundVoiceService;
