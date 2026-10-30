import React, { useEffect, useRef } from 'react';
import { useVoiceAssistant } from '../../voice/useVoiceAssistant';
import { VoiceState } from '../../voice/VoiceController';
import { VoiceDebugOverlay } from '../../voice/VoiceDebugOverlay';
import { Mic, MicOff, CheckCircle2, AlertTriangle, Send, X, Volume2, ShieldAlert } from 'lucide-react';
import { EmergencyManager } from '../../services/EmergencyManager';
import { t } from '../../voice/i18n';

/**
 * VoiceEmergencyModal — Powered by VoiceController singleton.
 * 
 * Flow:
 *  1. Floating mic pill rendered in bottom right:
 *     - Listens for "Hey SevaSetu" hands-free
 *     - Click immediately opens active emergency conversation
 *     - Long press or double click toggles Dev Debug Overlay
 *  2. Full-screen active conversational UI:
 *     - SevaSetu speaks aloud: "SevaSetu here. What's your emergency?"
 *     - Listens to user description without premature cutoff
 *     - Dispatches SOS immediately (SOS FIRST, NLP SECOND)
 *     - Confirms dispatch aloud and stays on line
 */
export function VoiceEmergencyModal({ autoActivate = false, handleClose: parentHandleClose }) {
  const voice = useVoiceAssistant();
  const longPressTimerRef = useRef(null);

  // Auto-activate if requested by parent (e.g. from external wake-word trigger)
  useEffect(() => {
    if (autoActivate && (voice.state === VoiceState.OFF || voice.state === VoiceState.ARMED_LISTENING_FOR_WAKE)) {
      voice.triggerEmergency('EXTERNAL');
    }
  }, [autoActivate]);

  // Ensure voice engine is armed for wake word when page is loaded
  useEffect(() => {
    if (voice.state === VoiceState.OFF) {
      voice.arm();
    }
  }, []);

  const handlePillClick = async (e) => {
    e.stopPropagation();
    voice.unlockAudio();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.warn('[VoiceEmergencyModal] getUserMedia notice:', err);
      }
    }
    voice.triggerEmergency('BUTTON');
  };

  const handlePillDoubleClick = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('sevasetu:toggle-voice-debug'));
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sevasetu:toggle-voice-debug'));
    }, 800);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const handleCancel = (e) => {
    if (e) e.stopPropagation();
    voice.cancelSession();
    if (parentHandleClose) parentHandleClose();
  };

  const handleManualSos = (e) => {
    if (e) e.stopPropagation();
    EmergencyManager.triggerEmergency('MANUAL_FALLBACK').catch(console.error);
    voice.commitTurn('Emergency SOS triggered manually. Immediate help required.');
  };

  const handleSendNow = (e) => {
    if (e) e.stopPropagation();
    const textToSend = voice.partialTranscript || voice.transcript;
    if (textToSend && textToSend.trim()) {
      voice.commitTurn(textToSend.trim());
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER 1: Passive Floating Pill (bottom-right)
  // ─────────────────────────────────────────────────────────────
  const isModalActive = voice.state !== VoiceState.OFF && voice.state !== VoiceState.ARMED_LISTENING_FOR_WAKE;

  return (
    <>
      <VoiceDebugOverlay />

      {!isModalActive && (
        <div
          data-testid="voice-mic-pill"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
            userSelect: 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handlePillDoubleClick}
        >
          <div style={{ position: 'relative' }}>
            {voice.isListening && (
              <div
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.35)',
                  animation: 'sevasetu-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
            )}
            <button
              data-testid="voice-enable-btn"
              onClick={handlePillClick}
              aria-label="Activate Voice Assistant"
              title="Click to talk or say 'Hey SevaSetu' (Double-click for debug)"
              style={{
                position: 'relative',
                zIndex: 1,
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: voice.isListening
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                  : 'linear-gradient(135deg, #dc2626, #ef4444)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}
            >
              {voice.isListening ? <Mic size={26} /> : <MicOff size={26} />}
            </button>
          </div>

          <span
            style={{
              fontSize: '0.72rem',
              color: voice.isListening ? '#15803d' : '#991b1b',
              fontWeight: 600,
              background: '#ffffff',
              padding: '0.3rem 0.65rem',
              borderRadius: '999px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: '1px solid rgba(0,0,0,0.06)'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: voice.isListening ? '#22c55e' : '#ef4444',
                animation: voice.isListening ? 'sevasetu-pulse 1.8s infinite' : 'none'
              }}
            />
            Say "Hey SevaSetu"
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          RENDER 2: Full-Screen Active Conversational Emergency Modal
          ───────────────────────────────────────────────────────────── */}
      {isModalActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'sevasetu-fade-in 0.2s ease'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              padding: '2.5rem 2rem',
              borderRadius: '1.5rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              maxWidth: '460px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            {/* Top Close Button */}
            <button
              onClick={handleCancel}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: '#94a3b8',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>

            {/* Pulsing Visualizer Orb */}
            <div style={{ position: 'relative', width: '104px', height: '104px', marginBottom: '1.5rem' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: voice.state === VoiceState.PROMPTING
                    ? 'rgba(59, 130, 246, 0.4)'
                    : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE
                    ? 'rgba(34, 197, 94, 0.4)'
                    : 'rgba(239, 68, 68, 0.4)',
                  animation: 'sevasetu-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  borderRadius: '50%',
                  width: '104px',
                  height: '104px',
                  background: voice.state === VoiceState.PROMPTING
                    ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                    : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE
                    ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                    : 'linear-gradient(135deg, #dc2626, #ef4444)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                }}
              >
                {voice.state === VoiceState.PROMPTING ? (
                  <Volume2 size={44} style={{ animation: 'sevasetu-pulse 1s infinite' }} />
                ) : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE ? (
                  <CheckCircle2 size={44} />
                ) : (
                  <Mic size={44} style={{ animation: 'sevasetu-pulse 1s infinite' }} />
                )}
              </div>
            </div>

            {/* Status Header */}
            <h2
              data-testid="voice-status"
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: '#f8fafc',
                margin: '0 0 0.5rem',
                letterSpacing: '-0.02em'
              }}
            >
              {voice.state === VoiceState.TRIGGERED && t('statusTriggered', voice.locale)}
              {voice.state === VoiceState.PROMPTING && t('statusPrompting', voice.locale)}
              {voice.state === VoiceState.LISTENING_USER && t('statusListening', voice.locale)}
              {voice.state === VoiceState.EXTRACTING && t('statusExtracting', voice.locale)}
              {voice.state === VoiceState.CONFIRMING && t('statusConfirming', voice.locale)}
              {voice.state === VoiceState.STAY_ON_LINE && t('statusStayOnLine', voice.locale)}
            </h2>

            {/* System Reply Bubble */}
            {voice.systemReply && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '0.85rem',
                  padding: '0.85rem 1rem',
                  marginTop: '0.75rem',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <p style={{ color: '#93c5fd', fontSize: '0.9rem', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                  🔊 <strong>SevaSetu:</strong> "{voice.systemReply}"
                </p>
              </div>
            )}

            {/* Live User Transcript Bubble */}
            <div
              data-testid="voice-transcript"
              style={{
                background: (voice.partialTranscript || voice.transcript)
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: (voice.partialTranscript || voice.transcript)
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '0.85rem',
                padding: '0.9rem 1rem',
                marginTop: '0.75rem',
                width: '100%',
                textAlign: 'left',
                minHeight: '64px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <p
                style={{
                  color: (voice.partialTranscript || voice.transcript) ? '#fca5a5' : '#94a3b8',
                  fontSize: '0.92rem',
                  margin: 0,
                  fontWeight: 500,
                  fontStyle: (voice.partialTranscript || voice.transcript) ? 'normal' : 'italic',
                  lineHeight: 1.4
                }}
              >
                {voice.partialTranscript || voice.transcript ? (
                  <>🎙️ <strong>You:</strong> "{voice.partialTranscript || voice.transcript}"</>
                ) : (
                  '🎙️ Speak now... e.g. "I am trapped in a fire with 3 people"'
                )}
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', width: '100%' }}>
              {voice.state === VoiceState.LISTENING_USER && (voice.partialTranscript || voice.transcript) && (
                <button
                  onClick={handleSendNow}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.75rem 1rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Send size={16} />
                  {t('sendButton', voice.locale)}
                </button>
              )}

              <button
                data-testid="voice-cancel-btn"
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('cancelButton', voice.locale)}
              </button>
            </div>

            {/* Instant Fallback Emergency SOS Button */}
            <button
              data-testid="sos-btn"
              onClick={handleManualSos}
              style={{
                marginTop: '1rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
              }}
            >
              <ShieldAlert size={18} />
              {t('sosButton', voice.locale)} (Instant Dispatch)
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sevasetu-ping {
          0% { transform: scale(1); opacity: 0.5; }
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes sevasetu-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes sevasetu-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default VoiceEmergencyModal;
