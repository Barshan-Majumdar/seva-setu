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

  const audioLevelPct = Math.min(100, (voice.audioLevel / 128) * 100);
  const audioColor = voice.audioLevel > 5 ? '#4ade80' : voice.audioLevel > 0 ? '#facc15' : '#ef4444';

  return (
    <div
      data-testid="voice-debug"
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        width: '340px',
        maxHeight: '50vh',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.97)',
        color: '#38bdf8',
        border: '1px solid #0284c7',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 999999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        lineHeight: 1.5
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>🛠️ VOICE DEBUG</span>
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

      {/* Audio Level Meter */}
      <div style={{ marginTop: '6px' }}>
        <strong>Mic Audio Level:</strong>
        <div style={{ height: '14px', background: '#1e293b', borderRadius: '7px', overflow: 'hidden', marginTop: '2px', border: '1px solid #334155' }}>
          <div style={{
            height: '100%',
            width: `${audioLevelPct}%`,
            background: audioColor,
            borderRadius: '7px',
            transition: 'width 80ms ease'
          }} />
        </div>
        <span style={{ color: audioColor, fontSize: '10px' }}>
          {voice.audioLevel?.toFixed(1) || '0.0'} / 255 {voice.audioLevel > 5 ? '✅ REAL AUDIO' : '⚠️ LOW/SILENT'}
        </span>
      </div>

      {/* Silent Mic Warning */}
      {voice.silentMicWarning && (
        <div style={{ marginTop: '4px', padding: '4px 6px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#fca5a5', fontSize: '10px' }}>
          ⚠️ SILENT MIC — Check chrome://settings/content/microphone
          <br />
          <a href="/voice-test.html" target="_blank" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Open Voice Diagnostic Tool →</a>
        </div>
      )}

      <div style={{ marginTop: '4px' }}><strong>clientEventId:</strong> <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{voice.clientEventId || 'none'}</span></div>

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

      <div style={{ marginTop: '6px', borderTop: '1px solid #334155', paddingTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <a href="/voice-test.html" target="_blank" style={{ color: '#38bdf8', fontSize: '10px' }}>Diagnostic Tool</a>
      </div>
    </div>
  );
}

export default VoiceDebugOverlay;
