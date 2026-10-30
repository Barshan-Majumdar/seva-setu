import { useState, useEffect, useCallback } from 'react';
import { voiceController, VoiceState } from './VoiceController';

/**
 * useVoiceAssistant — React hook binding cleanly to VoiceController singleton.
 * Guarantees zero stale closures and automatic subscription teardown.
 */
export function useVoiceAssistant() {
  const [snapshot, setSnapshot] = useState(() => voiceController.getSnapshot());

  useEffect(() => {
    const unsubscribe = voiceController.subscribe((newSnap) => {
      setSnapshot(newSnap);
    });
    return unsubscribe;
  }, []);

  const arm = useCallback(() => {
    voiceController.arm();
  }, []);

  const disarm = useCallback(() => {
    voiceController.disarm();
  }, []);

  const triggerEmergency = useCallback((source = 'BUTTON', initialSpeech = '') => {
    voiceController.triggerEmergencySession(source, initialSpeech);
  }, []);

  const commitTurn = useCallback((text) => {
    voiceController.commitUserTurn(text);
  }, []);

  const cancelSession = useCallback(() => {
    voiceController.cancelSession();
  }, []);

  const unlockAudio = useCallback(() => {
    voiceController.unlockAudio();
  }, []);

  return {
    ...snapshot,
    VoiceState,
    arm,
    disarm,
    triggerEmergency,
    commitTurn,
    cancelSession,
    unlockAudio,
  };
}

export default useVoiceAssistant;

