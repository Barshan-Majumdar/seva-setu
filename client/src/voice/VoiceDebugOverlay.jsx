import React, { useState, useEffect } from 'react';
import { useVoiceAssistant } from './useVoiceAssistant';

export function VoiceDebugOverlay() {
  const voice = useVoiceAssistant();
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('voiceDebug') === '1' || sessionStorage.getItem('sevasetu:voiceDebug') === '1';
    }
    return false;
  });

  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(prev => {
        const next = !prev;
        sessionStorage.setItem('sevasetu:voiceDebug', next ? '1' : '0');
        return next;
      });
    };
    window.addEventListener('sevasetu:toggle-voice-debug', handleToggle);
    return () => window.removeEventListener('sevasetu:toggle-voice-debug', handleToggle);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      data-testid="voice-debug"
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        width: '320px',
        maxHeight: '40vh',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.95)',
        color: '#38bdf8',
        border: '1px solid #0284c7',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 999999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        lineHeight: 1.4
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>🛠️ VOICE CONTROLLER DEBUG</span>
        <button
          onClick={() => setIsVisible(false)}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
        >
          ✕
        </button>
      </div>

      <div><strong>State:</strong> <span style={{ color: '#4ade80' }}>{voice.state}</span> (gen: {voice.generation})</div>
      <div><strong>Unlocked:</strong> {voice.isUnlocked ? '✅ Yes' : '❌ No'}</div>
      <div><strong>Listening:</strong> {voice.isListening ? '🎙️ Hot' : 'Muted'}</div>
      <div><strong>Speaking:</strong> {voice.isSpeaking ? '🔊 Active' : 'Idle'}</div>
      <div><strong>clientEventId:</strong> <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{voice.clientEventId || 'none'}</span></div>

      {voice.partialTranscript && (
        <div style={{ marginTop: '4px', color: '#facc15' }}>
          <strong>Partial:</strong> "{voice.partialTranscript}"
        </div>
      )}

      {voice.transcript && (
        <div style={{ marginTop: '4px', color: '#f8fafc' }}>
          <strong>Committed:</strong> "{voice.transcript}"
        </div>
      )}

      {voice.systemReply && (
        <div style={{ marginTop: '4px', color: '#a78bfa' }}>
          <strong>Reply:</strong> "{voice.systemReply}"
        </div>
      )}

      {voice.error && (
        <div style={{ marginTop: '4px', color: '#ef4444' }}>
          <strong>Error:</strong> {voice.error}
        </div>
      )}

      {voice.emergencyData && (
        <div style={{ marginTop: '6px', borderTop: '1px dashed #334155', paddingTop: '4px', color: '#f43f5e' }}>
          <strong>Emergency Facts:</strong>
          <pre style={{ margin: 0, fontSize: '9px' }}>{JSON.stringify(voice.emergencyData.facts, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default VoiceDebugOverlay;

