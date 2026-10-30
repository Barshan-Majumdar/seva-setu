import React, { useState, useEffect, useRef } from 'react';
import { useVoiceAssistant } from '../../voice/useVoiceAssistant';
import { VoiceState } from '../../voice/VoiceController';
import { VoiceDebugOverlay } from '../../voice/VoiceDebugOverlay';
import { Mic, MicOff, CheckCircle2, AlertTriangle, Send, X, Volume2, ShieldAlert, Sparkles } from 'lucide-react';
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
  const [typedText, setTypedText] = useState('');
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

  // Handle auto-close events triggered by VoiceController
  useEffect(() => {
    const handleAutoClose = () => {
      if (parentHandleClose) parentHandleClose();
    };
    window.addEventListener('sevasetu:emergency-closed', handleAutoClose);
    return () => window.removeEventListener('sevasetu:emergency-closed', handleAutoClose);
  }, [parentHandleClose]);

  const handlePillClick = (e) => {
    e.stopPropagation();
    voice.unlockAudio();
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

  const handleQuickEmergency = (text) => {
    voice.commitTurn(text);
  };

  const handleTypedSubmit = (e) => {
    if (e) e.preventDefault();
    if (typedText && typedText.trim()) {
      voice.commitTurn(typedText.trim());
      setTypedText('');
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
            bottom: '104px',
            right: '32px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column-reverse',
            alignItems: 'flex-end',
            gap: '10px',
            userSelect: 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handlePillDoubleClick}
        >
          {/* Floating Mic Action Button (Linear with chat button below) */}
          <div style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
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
              title="Click to talk or say 'Hey, SevaSetu' (Double-click for debug)"
              style={{
                position: 'relative',
                zIndex: 1,
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: voice.isListening
                  ? 'linear-gradient(135deg, #1e4231, #2d6148)'
                  : 'linear-gradient(135deg, #dc2626, #ef4444)',
                color: '#ffffff',
                border: 'none',
                boxShadow: voice.isListening
                  ? '0 10px 28px rgba(45, 97, 72, 0.35)'
                  : '0 10px 28px rgba(220, 38, 38, 0.25)',
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

          {/* Highlighted Callout Box on Top Side indicating Voice Assistant & Wake-word */}
          <div
            onClick={handlePillClick}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.45rem 0.95rem',
              background: '#ffffff',
              borderRadius: '999px',
              border: voice.isListening ? '1.5px solid #059669' : '1.5px solid rgba(220, 38, 38, 0.3)',
              boxShadow: voice.isListening
                ? '0 4px 16px rgba(5, 150, 105, 0.16), 0 0 0 2px rgba(5, 150, 105, 0.08)'
                : '0 4px 14px rgba(0, 0, 0, 0.08)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(5, 150, 105, 0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = voice.isListening
                ? '0 4px 16px rgba(5, 150, 105, 0.16), 0 0 0 2px rgba(5, 150, 105, 0.08)'
                : '0 4px 14px rgba(0, 0, 0, 0.08)';
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: voice.isListening ? '#059669' : '#ef4444',
                animation: voice.isListening ? 'sevasetu-pulse 1.8s infinite' : 'none',
                boxShadow: voice.isListening ? '0 0 8px #10b981' : 'none',
                flexShrink: 0
              }}
            />
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: voice.isListening ? '#1e4231' : '#991b1b',
                letterSpacing: '-0.01em',
              }}
            >
              Say &ldquo;Hey, SevaSetu&rdquo;
            </span>

            {/* Pointer arrow on bottom pointing down into the center of the voice button */}
            <span
              style={{
                position: 'absolute',
                right: '25px',
                bottom: '-5px',
                transform: 'rotate(45deg)',
                width: '10px',
                height: '10px',
                background: '#ffffff',
                borderRight: voice.isListening ? '1.5px solid #059669' : '1.5px solid rgba(220, 38, 38, 0.3)',
                borderBottom: voice.isListening ? '1.5px solid #059669' : '1.5px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '1px'
              }}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          RENDER 2: Conversational Emergency Modal (Light Green & Off-White Theme)
          ───────────────────────────────────────────────────────────── */}
      {isModalActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(12px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'sevasetu-fade-in 0.2s ease'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #f9fbf9 100%)',
              border: '1px solid rgba(45, 97, 72, 0.18)',
              padding: '2.25rem 2rem 2rem',
              borderRadius: '1.75rem',
              boxShadow: '0 25px 60px -15px rgba(30, 66, 49, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
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
                top: '1.2rem',
                right: '1.2rem',
                background: 'rgba(15, 23, 42, 0.05)',
                border: 'none',
                color: '#64748b',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.1)';
                e.currentTarget.style.color = '#0f171d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.05)';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>

            {/* Top Brand Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.85rem',
                borderRadius: '999px',
                background: 'rgba(45, 97, 72, 0.08)',
                border: '1px solid rgba(45, 97, 72, 0.18)',
                color: '#2d6148',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '1.25rem'
              }}
            >
              <Sparkles size={13} color="#2d6148" />
              SevaSetu Voice Assistant
            </div>

            {/* Pulsing Visualizer Orb */}
            <div style={{ position: 'relative', width: '104px', height: '104px', marginBottom: '1.25rem' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: voice.state === VoiceState.PROMPTING
                    ? 'rgba(45, 97, 72, 0.2)'
                    : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE
                    ? 'rgba(5, 150, 105, 0.25)'
                    : voice.isTranscribing
                    ? 'rgba(217, 119, 6, 0.25)'
                    : 'rgba(16, 185, 129, 0.25)',
                  animation: 'sevasetu-ping 1.6s cubic-bezier(0,0,0.2,1) infinite',
                }}
              />
              <div
                onClick={() => {
                  if (voice.state === VoiceState.LISTENING_USER || voice.state === VoiceState.STAY_ON_LINE) {
                    voice.finishSpeakingNow();
                  }
                }}
                title={voice.state === VoiceState.LISTENING_USER ? "Tap to finish speaking & submit immediately" : ""}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  borderRadius: '50%',
                  width: '104px',
                  height: '104px',
                  background: voice.state === VoiceState.PROMPTING
                    ? 'linear-gradient(135deg, #1e4231, #2d6148)'
                    : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE
                    ? 'linear-gradient(135deg, #1e4231, #2d6148)'
                    : voice.isTranscribing
                    ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                    : 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: voice.isTranscribing
                    ? '0 12px 30px rgba(217, 119, 6, 0.35)'
                    : voice.state === VoiceState.PROMPTING
                    ? '0 12px 30px rgba(30, 66, 49, 0.35)'
                    : '0 12px 30px rgba(5, 150, 105, 0.35)',
                  cursor: (voice.state === VoiceState.LISTENING_USER || voice.state === VoiceState.STAY_ON_LINE) ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (voice.state === VoiceState.LISTENING_USER) e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1.0)';
                }}
              >
                {voice.state === VoiceState.PROMPTING ? (
                  <Volume2 size={42} style={{ animation: 'sevasetu-pulse 1s infinite' }} />
                ) : voice.state === VoiceState.CONFIRMING || voice.state === VoiceState.STAY_ON_LINE ? (
                  <CheckCircle2 size={42} />
                ) : voice.isTranscribing ? (
                  <Sparkles size={42} style={{ animation: 'sevasetu-pulse 0.8s infinite' }} />
                ) : (
                  <Mic size={42} style={{ animation: 'sevasetu-pulse 1s infinite' }} />
                )}
              </div>
            </div>

            {/* Quick Submit Tap Hint (Hidden during auto-dispatch) */}
            {voice.state === VoiceState.LISTENING_USER && !voice.isTranscribing && !voice.hasAutoDispatched && !voice.candidateIntent?.isEmergency && (
              <button
                type="button"
                onClick={() => voice.finishSpeakingNow()}
                style={{
                  background: 'rgba(45, 97, 72, 0.08)',
                  border: '1px solid rgba(45, 97, 72, 0.2)',
                  borderRadius: '999px',
                  color: '#2d6148',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '0.28rem 0.85rem',
                  cursor: 'pointer',
                  marginBottom: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(45, 97, 72, 0.16)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(45, 97, 72, 0.08)';
                }}
              >
                <span>Done speaking? Tap to send</span> ⚡
              </button>
            )}

            {/* Status Header */}
            <h2
              data-testid="voice-status"
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0f171d',
                margin: '0 0 0.4rem',
                letterSpacing: '-0.02em'
              }}
            >
              {voice.state === VoiceState.TRIGGERED && t('statusTriggered', voice.locale)}
              {voice.state === VoiceState.PROMPTING && t('statusPrompting', voice.locale)}
              {voice.state === VoiceState.LISTENING_USER && (
                voice.candidateIntent?.isEmergency 
                  ? '🚨 Emergency Detected • Submitting...' 
                  : (voice.isTranscribing ? 'Processing your voice...' : t('statusListening', voice.locale))
              )}
              {voice.state === VoiceState.EXTRACTING && '🚨 Emergency Detected • Submitting...'}
              {voice.state === VoiceState.CONFIRMING && t('statusConfirming', voice.locale)}
              {voice.state === VoiceState.STAY_ON_LINE && t('statusStayOnLine', voice.locale)}
            </h2>

            {/* System Reply Bubble */}
            {voice.systemReply && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                  borderRadius: '1rem',
                  padding: '0.85rem 1.1rem',
                  marginTop: '0.75rem',
                  width: '100%',
                  textAlign: 'left',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.05)'
                }}
              >
                <p style={{ color: '#166534', fontSize: '0.9rem', margin: 0, fontWeight: 500, lineHeight: 1.45 }}>
                  🔊 <strong style={{ color: '#065f46' }}>SevaSetu:</strong> "{voice.systemReply}"
                </p>
              </div>
            )}

            {/* Auto-closing countdown indicator when dispatch confirmed */}
            {voice.state === VoiceState.CONFIRMING && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.6rem',
                  fontSize: '0.78rem',
                  color: '#2d6148',
                  fontWeight: 600,
                  background: 'rgba(45, 97, 72, 0.08)',
                  padding: '0.28rem 0.85rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(45, 97, 72, 0.15)'
                }}
              >
                <CheckCircle2 size={13} color="#2d6148" />
                <span>Emergency logged • Auto-closing session in a moment...</span>
              </div>
            )}

            {/* Live User Transcript Bubble */}
            <div
              data-testid="voice-transcript"
              style={{
                background: (voice.partialTranscript || voice.transcript)
                  ? '#ffffff'
                  : '#f8fafc',
                border: (voice.partialTranscript || voice.transcript)
                  ? '1.5px solid #2d6148'
                  : '1.5px dashed rgba(100, 116, 139, 0.22)',
                boxShadow: (voice.partialTranscript || voice.transcript)
                  ? '0 4px 12px rgba(45, 97, 72, 0.08)'
                  : 'none',
                borderRadius: '1rem',
                padding: '0.9rem 1.1rem',
                marginTop: '0.75rem',
                width: '100%',
                textAlign: 'left',
                minHeight: '64px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <p
                style={{
                  color: (voice.partialTranscript || voice.transcript) ? '#0f171d' : '#64748b',
                  fontSize: '0.92rem',
                  margin: 0,
                  fontWeight: (voice.partialTranscript || voice.transcript) ? 600 : 500,
                  fontStyle: (voice.partialTranscript || voice.transcript) ? 'normal' : 'italic',
                  lineHeight: 1.45
                }}
              >
                {voice.partialTranscript || voice.transcript ? (
                  <>🎙️ <strong style={{ color: '#2d6148' }}>You:</strong> "{voice.partialTranscript || voice.transcript}"</>
                ) : (
                  '🎙️ Speak now... e.g. "I am trapped in a fire with 3 people"'
                )}
              </p>
            </div>

            {/* Audio Level Indicator */}
            {voice.isListening && (
              <div style={{ marginTop: '0.75rem', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>🎤 Mic Level</span>
                  <span style={{ fontSize: '0.72rem', color: voice.audioLevel > 5 ? '#059669' : '#d97706', fontWeight: 700 }}>
                    {voice.audioLevel > 5 ? 'Hearing audio' : 'Low/silent'}
                  </span>
                </div>
                <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (voice.audioLevel / 128) * 100)}%`,
                    background: voice.audioLevel > 5 ? 'linear-gradient(90deg, #10b981, #059669)' : '#f59e0b',
                    borderRadius: '999px',
                    transition: 'width 80ms ease'
                  }} />
                </div>
              </div>
            )}

            {/* Silent Mic Warning */}
            {voice.silentMicWarning && (
              <div style={{ marginTop: '0.65rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.65rem 0.9rem', color: '#991b1b', fontSize: '0.78rem', width: '100%', textAlign: 'left' }}>
                <p style={{ margin: '0 0 0.3rem', fontWeight: 700 }}>⚠️ Your microphone appears to be sending silence</p>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.73rem', color: '#64748b', lineHeight: 1.35 }}>
                  Chrome may be using a virtual audio device. Fix: open <strong>chrome://settings/content/microphone</strong> and select your physical microphone, then reload.
                </p>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <a href="/voice-test.html" target="_blank" style={{ background: '#2d6148', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>Open Diagnostic</a>
                  <button type="button" onClick={() => voice.arm()} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Retry Mic</button>
                </div>
              </div>
            )}

            {/* STT Status / Error Alert */}
            {voice.error && !voice.silentMicWarning && (
              <div style={{ marginTop: '0.65rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.5rem 0.9rem', color: '#991b1b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>⚠️ {voice.error}</span>
                <button type="button" onClick={() => voice.arm()} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '0.2rem 0.55rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Retry Mic</button>
              </div>
            )}

            {/* Direct Text Input Fallback */}
            <form onSubmit={handleTypedSubmit} style={{ display: 'flex', gap: '0.45rem', width: '100%', marginTop: '0.85rem' }}>
              <input
                type="text"
                placeholder="Or type what happened..."
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: '1px solid rgba(17, 24, 39, 0.15)',
                  borderRadius: '0.75rem',
                  padding: '0.6rem 0.95rem',
                  color: '#0f171d',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2d6148'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(17, 24, 39, 0.15)'; }}
              />
              <button
                type="submit"
                disabled={!typedText.trim()}
                style={{
                  padding: '0.6rem 1rem',
                  background: typedText.trim() ? 'linear-gradient(135deg, #1e4231, #2d6148)' : '#e2e8f0',
                  color: typedText.trim() ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: typedText.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
              >
                <Send size={15} />
              </button>
            </form>

            {/* Quick Emergency Category Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}>
              <button type="button" onClick={() => handleQuickEmergency('Fire emergency! People trapped inside building.')} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.35rem 0.75rem', borderRadius: '0.6rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}>🔥 Fire</button>
              <button type="button" onClick={() => handleQuickEmergency('Severe medical emergency, urgent ambulance needed.')} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '0.35rem 0.75rem', borderRadius: '0.6rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}>🩹 Medical</button>
              <button type="button" onClick={() => handleQuickEmergency('Severe flooding, people stranded and need rescue.')} style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#115e59', padding: '0.35rem 0.75rem', borderRadius: '0.6rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}>🌊 Flood</button>
              <button type="button" onClick={() => handleQuickEmergency('Severe road accident, people injured, send help immediately.')} style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.35rem 0.75rem', borderRadius: '0.6rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}>🚗 Accident</button>
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', width: '100%' }}>
              {voice.state === VoiceState.LISTENING_USER && (voice.partialTranscript || voice.transcript) && (
                <button
                  onClick={handleSendNow}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)'
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
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.color = '#0f171d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
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
                marginTop: '0.85rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.85rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(220, 38, 38, 0.25)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}
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
