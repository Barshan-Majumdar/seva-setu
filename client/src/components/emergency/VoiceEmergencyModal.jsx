import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { speechService } from '../../services/SpeechService';
import { nativeSpeechBridge } from '../../services/NativeSpeechBridge';
import { EmergencyManager } from '../../services/EmergencyManager';
import { VoiceFeedback } from '../../services/VoiceFeedback';
import { Mic, MicOff, CheckCircle2, Volume2 } from 'lucide-react';

/**
 * VoiceEmergencyModal â€” SevaSetu Voice Assistant UI
 * 
 * Behavior:
 *   1. On page load â†’ checks if mic permission already granted
 *      - If YES â†’ silently starts listening for "Hey Seva Setu" (no click needed)
 *      - If NO  â†’ shows mic button. User clicks ONCE to grant permission.
 *   2. User says "Hey Seva Setu" OR clicks button â†’ NLP modal opens
 *   3. SevaSetu speaks back, user describes emergency, SOS is created
 *   4. After close â†’ returns to passive wake word listening
 */
const DebugPanel = ({ sessionState, debugLogs }) => {
  if (!Capacitor.isNativePlatform()) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: 'rgba(0,0,0,0.9)', color: '#0f0',
      fontFamily: 'monospace', fontSize: '10px',
      padding: '4px', zIndex: 99999,
      maxHeight: '35vh', overflowY: 'auto',
      lineHeight: '1.3'
    }}>
      <div style={{color: '#ff0', fontWeight: 'bold', marginBottom: '2px'}}>
        STATE: {sessionState} | Bridge: {nativeSpeechBridge.statusText}
      </div>
      {debugLogs.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
};

export const VoiceEmergencyModal = ({ open = false, autoActivate = false, handleClose: parentHandleClose }) => {
  // idle | listening_for_wake | active_session | processing | completed | error
  const [sessionState, setSessionState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [systemReply, setSystemReply] = useState('');
  const [emergencyData, setEmergencyData] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const hasTriggeredRef = useRef(false);
  const mountedRef = useRef(true);

  // â”€â”€â”€ Local helper: does transcript look like a genuine emergency? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Used in the catch block to avoid firing false SOS when AI service is down.
  const _looksLikeEmergency = (t) => {
    const s = t.toLowerCase();
    const EMERGENCY_SIGNALS = [
      'fire','burning','flood','drowning','collapse','collapsed','trapped','stuck',
      'injured','hurt','bleeding','blood','unconscious','fainted','heart attack',
      'chest pain','cannot breathe',"can't breathe",'not breathing','seizure',
      'stroke','ambulance','medical','accident','crash','help','save','sos',
      'mayday','emergency','danger','attack','dying','bachao','madad','aag',
    ];
    return EMERGENCY_SIGNALS.some(w => s.includes(w));
  };

  // â”€â”€â”€ Handle emergency SOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleEmergencyTrigger = async (text) => {
      setSessionState('processing');
      if (Capacitor.isNativePlatform()) {
        nativeSpeechBridge.pause();
      } else {
        speechService.stop();
      }

      try {
        // 1. Ask NLP about intent BEFORE triggering SOS
        //    AbortController enforces a strict 6-second timeout â€” prevents UI hanging
        //    if the AI endpoint is asleep or unreachable.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const AI_URL = import.meta.env.VITE_AI_URL || (Capacitor.isNativePlatform() ? 'http://10.103.7.193:8000' : 'http://localhost:8000');
        const aiResponse = await fetch(`${AI_URL}/extract-facts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text, language: 'en-IN' }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!aiResponse.ok) {
          throw new Error(`AI returned ${aiResponse.status}`);
        }

        const nlpData = await aiResponse.json();

        if (nlpData.isEmergency) {
          const intentName = nlpData.intent !== 'UNKNOWN' ? nlpData.intent.toLowerCase().replace('_', ' ') : 'emergency';
          const ackReply = nlpData.reply || `Got it. Sending SOS now for: ${intentName}. Help is on the way to your location.`;
          setSystemReply(ackReply);
          VoiceFeedback.speak(ackReply); // Fire-and-forget (SOS is non-blocking)

          const emergency = await EmergencyManager.triggerEmergency('VOICE', null);
          setEmergencyData(emergency);

          // Push the facts we already gathered to the server
          const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

          // Push facts with retry logic to avoid race condition with non-blocking SOS trigger
          const pushFacts = async (retries = 3) => {
            try {
              const res = await fetch(`${API_URL}/api/emergency/${emergency.clientEventId}/facts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nlpData)
              });
              if (res.status === 404 && retries > 0) {
                console.log('Incident not found yet, retrying facts push...');
                setTimeout(() => pushFacts(retries - 1), 1000);
              } else if (!res.ok) {
                console.warn('Facts push failed:', res.status);
              } else {
                console.log('Facts pushed successfully!');
              }
            } catch (err) {
              if (retries > 0) setTimeout(() => pushFacts(retries - 1), 1000);
              else console.warn('Facts push error:', err);
            }
          };
          pushFacts();

          if (mountedRef.current) {
            setSessionState('completed');
            // Auto-close 5 seconds after SOS is confirmed
            setTimeout(() => {
              if (mountedRef.current) handleClose();
            }, 5000);
          }
        } else {
          // Conversational interaction (not an emergency yet)
          const reply = nlpData.reply || "I'm here to help. How can I assist you?";
          setSystemReply(reply);

          if (nlpData.intent === 'SAFE' || nlpData.intent === 'CANCEL' || nlpData.intent === 'CLOSE_SESSION') {
            setSessionState('speaking');
            // Use onEnd callback so modal closes AFTER TTS finishes
            VoiceFeedback.speak(reply, () => {
              if (mountedRef.current) handleClose();
            });
          } else {
            setSessionState('speaking');
            // Use onEnd callback so mic resumes AFTER TTS finishes (no echo)
            VoiceFeedback.speak(reply, () => {
              if (mountedRef.current) startCapturing();
            });
          }
        }
      } catch (e) {
        const wasAborted = e.name === 'AbortError';
        console.error('[VoiceUI] NLP check failed' + (wasAborted ? ' (timeout)' : '') + ', evaluating locally:', e);

        // SAFETY GUARD: Only trigger SOS if the transcript has genuine emergency signals.
        // This prevents a false SOS when the user says "hello" or "cancel" but AI is down.
        if (!_looksLikeEmergency(text)) {
          console.warn('[VoiceUI] Transcript does not look like an emergency â€” not triggering SOS. Closing session.');
          setSystemReply("I'm sorry, I had trouble understanding that. If you have an emergency, please try again or call 112.");
          setSessionState('error');
          setTimeout(() => {
            if (mountedRef.current) handleClose();
          }, 4000);
          return;
        }

        const ackReply = 'Got it. Sending SOS now.';
        setSystemReply(ackReply);
        VoiceFeedback.speak(ackReply); // Fire and forget

        const emergency = await EmergencyManager.triggerEmergency('VOICE', null);
        setEmergencyData(emergency);
        EmergencyManager.enrichEmergencyWithVoice(emergency.clientEventId, text);

        const doneReply = 'Help request started. Your SOS has been transmitted. Stay safe.';
        setSystemReply(doneReply);
        VoiceFeedback.speak(doneReply); // Fire and forget

        if (mountedRef.current) {
          setSessionState('completed');
          setTimeout(() => {
            if (mountedRef.current) handleClose();
          }, 5000);
        }
      }
    };

    
  // â”€â”€ Start capturing emergency description (called after system finishes speaking) â”€â”€
  const startCapturing = useCallback(() => {
    if (!mountedRef.current) return;
    hasTriggeredRef.current = false;

    const handleFinal = (finalText) => {
      if (hasTriggeredRef.current) return;
      setTranscript(finalText);
      if (finalText.trim().length > 0) {
        hasTriggeredRef.current = true;
        handleEmergencyTrigger(finalText);
      }
    };

    const handlePartial = (interimText) => {
      if (!hasTriggeredRef.current && mountedRef.current) {
        setTranscript(interimText);
      }
    };

    const handleError = (err) => {
      if (!hasTriggeredRef.current && mountedRef.current) {
        setSessionState('error');
      }
    };

    if (Capacitor.isNativePlatform()) {
      // On native: use the unified bridge (sole owner of the Android mic)
      setSessionState('active_session');
      nativeSpeechBridge.startConversation({
        onTranscript: handleFinal,
        onPartialTranscript: handlePartial,
        onError: handleError,
      });
    } else {
      // On web: use SpeechService as before
      speechService.stop();
      setTimeout(() => {
        if (!mountedRef.current) return;
        setSessionState('active_session');
        speechService.start(
          null,
          handleFinal,
          handleError,
          null,
          handlePartial
        );
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // â”€â”€ Start passive wake word listening (WEB ONLY â€” native uses BackgroundVoiceService) â”€â”€
  const beginWakeWordListening = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      // On native, wake word is handled by BackgroundVoiceService via NativeSpeechBridge.
      // VoiceEmergencyModal should NOT start its own wake word listener on native.
      setSessionState('listening_for_wake');
      return;
    }

    if (!speechService.isSupported) {
      setSessionState('error');
      return;
    }

    setSessionState('listening_for_wake');
    speechService.stop();

    setTimeout(() => {
      if (!mountedRef.current) return;
      speechService.start(
        (trailingCommand) => {
          // trailingCommand: text spoken after wake word in same breath
          console.log('[VoiceUI] Wake word detected (web). Trailing:', trailingCommand);
          speechService.stop();
          if (mountedRef.current) {
            setSessionState('speaking');
            setTranscript('');
            if (trailingCommand && trailingCommand.trim().length > 3) {
              // One-breath command: skip re-prompting, process directly
              console.log('[VoiceUI] One-breath command preserved:', trailingCommand);
              handleEmergencyTrigger(trailingCommand.trim());
            } else {
              const reply = 'Are you experiencing an emergency? Please state the nature of your emergency.';
              setSystemReply(reply);
              // Use onEnd callback to prevent audio echo
              VoiceFeedback.speak(reply, () => {
                if (mountedRef.current) startCapturing();
              });
            }
          }
        },
        () => {},
        (err) => {
          if (err === 'not-allowed' && mountedRef.current) {
            setSessionState('idle');
          }
        }
      );
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCapturing]);

  // â”€â”€ On mount: auto-activate or start wake word â”€â”€
  useEffect(() => {
    mountedRef.current = true;

    if (autoActivate) {
      // Opened by BackgroundVoiceService wake word detection
      console.log('[VoiceUI] Auto-activating from background wake word');
      setSessionState('speaking');
      setTranscript('');
      const reply = "Are you experiencing an emergency? Please state the nature of your emergency.";
      setSystemReply(reply);
      // Use onEnd callback so mic opens AFTER TTS finishes — prevents audio echo
      VoiceFeedback.speak(reply, () => {
        if (mountedRef.current) startCapturing();
      });
    } else if (!Capacitor.isNativePlatform()) {
      // Web: check permissions and start wake word listening
      if (speechService.isSupported) {
        speechService.checkPermissions().then((isGranted) => {
          if (isGranted && mountedRef.current) {
            console.log('[VoiceUI] Web: mic granted, starting wake word');
            beginWakeWordListening();
          }
        });
      }
    } else {
      // Native: wake word is handled by BackgroundVoiceService, just show idle/listening state
      setSessionState('listening_for_wake');
    }

    return () => {
      mountedRef.current = false;
      if (Capacitor.isNativePlatform()) {
        nativeSpeechBridge.pause();
      } else {
        speechService.stop();
      }
      VoiceFeedback.stop();
    };
  }, [autoActivate, startCapturing, beginWakeWordListening]);

  // Subscribe to NativeSpeechBridge debug updates (native only)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setDebugLogs(nativeSpeechBridge.getDebugLog());
      nativeSpeechBridge.onDebugUpdate((logs) => {
        if (mountedRef.current) setDebugLogs(logs);
      });
      return () => nativeSpeechBridge.onDebugUpdate(null);
    }
  }, []);


    // â”€â”€ Manual button click â†’ skip wake word, go directly to active listening â”€â”€
    const handleManualActivate = useCallback(() => {
      setSessionState('speaking');
      setTranscript('');
      hasTriggeredRef.current = false;
    
      // Stop any current mic session
      if (Capacitor.isNativePlatform()) {
        nativeSpeechBridge.pause();
      } else {
        speechService.stop();
      }

      const reply = "I'm listening. What's the emergency?";
      setSystemReply(reply);
      // Use onEnd callback so mic opens AFTER TTS finishes — prevents audio echo
      VoiceFeedback.speak(reply, () => {
        if (mountedRef.current) startCapturing();
      });
    }, [startCapturing]);

    // â”€â”€ Close â†’ go back to passive wake word listening OR close entirely â”€â”€
  const handleClose = () => {
    if (Capacitor.isNativePlatform()) {
      nativeSpeechBridge.pause();
    } else {
      speechService.stop();
    }
    VoiceFeedback.stop();
    setTranscript('');
    setSystemReply('');
    setEmergencyData(null);
    hasTriggeredRef.current = false;
    
    // Always reset session state back to passive listening
    if (Capacitor.isNativePlatform()) {
      setSessionState('listening_for_wake');
    } else {
      setSessionState('idle');
      setTimeout(() => {
        if (mountedRef.current) beginWakeWordListening();
      }, 300);
    }

    if (parentHandleClose) {
      parentHandleClose();
    }
  };

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DEBUG PANEL (native only â€” remove after debugging)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DebugPanel moved to top level

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // RENDER: Idle â€” Permission not yet granted, show button
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (sessionState === 'idle') {
      return (
        <>
          <DebugPanel sessionState={sessionState} debugLogs={debugLogs} />
          <div style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            zIndex: 9999, gap: '0.5rem'
          }}>
          <button
            onClick={handleManualActivate}
            aria-label="Activate Voice SOS"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff', border: 'none', borderRadius: '50%',
              width: '56px', height: '56px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.5)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Mic size={24} />
          </button>
          <span style={{
            fontSize: '0.7rem', color: '#94a3b8',
            background: '#fff', padding: '0.25rem 0.5rem',
            borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}>
            Tap or say "Hey Seva Setu"
          </span>
          </div>
        </>
      );
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // RENDER: Wake Word Listening â€” Passively listening for "Hey Seva Setu"
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (sessionState === 'listening_for_wake') {
      return (
        <>
          <DebugPanel sessionState={sessionState} debugLogs={debugLogs} />
          <div style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          zIndex: 9999, gap: '0.5rem'
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: '-5px', borderRadius: '50%',
              border: '2px solid #22c55e',
              animation: 'breathe 2s ease-in-out infinite',
            }} />
            <button
              onClick={handleManualActivate}
              aria-label="Speak emergency now"
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#fff', border: 'none', borderRadius: '50%',
                width: '56px', height: '56px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(239, 68, 68, 0.6)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Mic size={24} />
            </button>
          </div>
          <span style={{
            fontSize: '0.7rem', color: '#22c55e', fontWeight: 600,
            background: '#fff', padding: '0.3rem 0.6rem',
            borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e',
              animation: 'breathe 2s ease-in-out infinite',
            }} />
            Say "Hey Seva Setu"
          </span>

          <style>{`
          @keyframes breathe {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.2); opacity: 0.8; }
          }
        `}</style>
        </div>
        </>
      );
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // RENDER: Full-screen Modal
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    return (
      <>
        <DebugPanel sessionState={sessionState} debugLogs={debugLogs} />
        <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          background: '#18181b', border: '1px solid #27272a',
          padding: '2.5rem 2rem', borderRadius: '1.25rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          maxWidth: '440px', width: '100%', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>

          {/* â”€â”€ Active Listening â”€â”€ */}
          {sessionState === 'active_session' && (
            <>
              <div style={{ position: 'relative', width: '96px', height: '96px', marginBottom: '1.5rem' }}>
                <div style={{
                  position: 'absolute', inset: 0, background: '#ef4444', borderRadius: '50%',
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.4,
                }} />
                <div style={{
                  position: 'relative', zIndex: 1, background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: '96px', height: '96px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Mic size={40} style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                </div>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>
                NLP Activated â€” Listening...
              </h2>
              {systemReply && (
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem',
                  marginTop: '0.75rem', width: '100%', textAlign: 'left',
                }}>
                  <p style={{ color: '#93c5fd', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                    ðŸ”Š SevaSetu: "{systemReply}"
                  </p>
                </div>
              )}
              {transcript && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem',
                  marginTop: '0.5rem', width: '100%', textAlign: 'left',
                }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                    ðŸŽ¤ You: "{transcript}"
                  </p>
                </div>
              )}
            
              <button onClick={handleClose} style={{
                marginTop: '1.5rem', padding: '0.5rem 1.5rem',
                background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem',
                transition: 'background 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
                onMouseLeave={e => e.currentTarget.style.background = '#27272a'}>
                Cancel Session
              </button>
            </>
          )}

          {/* â”€â”€ Speaking â”€â”€ */}
          {sessionState === 'speaking' && (
            <>
              <div style={{ position: 'relative', width: '96px', height: '96px', marginBottom: '1.5rem' }}>
                <div style={{
                  position: 'relative', zIndex: 1, background: '#3b82f6', color: '#fff',
                  borderRadius: '50%', width: '96px', height: '96px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
                }}>
                  <Volume2 size={40} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>
                Speaking...
              </h2>
              {systemReply && (
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem',
                  marginTop: '0.75rem', width: '100%', textAlign: 'left',
                }}>
                  <p style={{ color: '#93c5fd', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                    ðŸ”Š SevaSetu: "{systemReply}"
                  </p>
                </div>
              )}
            
              <button onClick={handleClose} style={{
                marginTop: '1.5rem', padding: '0.5rem 1.5rem',
                background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem',
                transition: 'background 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
                onMouseLeave={e => e.currentTarget.style.background = '#27272a'}>
                Cancel Session
              </button>
            </>
          )}

          {/* â”€â”€ Processing â”€â”€ */}
          {sessionState === 'processing' && (
            <>
              <div style={{
                width: '64px', height: '64px', border: '4px solid #ef4444',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', marginBottom: '1.5rem',
              }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.75rem' }}>
                Sending SOS...
              </h2>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '0.75rem', padding: '0.6rem 0.8rem', textAlign: 'left',
                }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.8rem', margin: 0 }}>ðŸŽ¤ You: "{transcript}"</p>
                </div>
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '0.75rem', padding: '0.6rem 0.8rem', textAlign: 'left',
                }}>
                  <p style={{ color: '#93c5fd', fontSize: '0.8rem', margin: 0 }}>ðŸ”Š SevaSetu: "{systemReply}"</p>
                </div>
              </div>
              <p style={{ color: '#52525b', fontSize: '0.7rem', marginTop: '1rem' }}>
                AI extracting emergency facts...
              </p>
            </>
          )}

          {/* â”€â”€ Completed â”€â”€ */}
          {sessionState === 'completed' && (
            <>
              <div style={{
                background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem',
              }}>
                <CheckCircle2 size={48} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>
                SOS Transmitted
              </h2>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: '0.75rem', padding: '0.6rem 0.8rem', textAlign: 'left',
                }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.8rem', margin: 0 }}>ðŸŽ¤ You: "{transcript}"</p>
                </div>
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
                  borderRadius: '0.75rem', padding: '0.6rem 0.8rem', textAlign: 'left',
                }}>
                  <p style={{ color: '#86efac', fontSize: '0.8rem', margin: 0 }}>ðŸ”Š SevaSetu: "{systemReply}"</p>
                </div>
              </div>
              <button onClick={handleClose} style={{
                marginTop: '0.5rem', padding: '0.5rem 1.5rem',
                background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem',
              }}>
                Close
              </button>
            </>
          )}

          {/* â”€â”€ Error â”€â”€ */}
          {sessionState === 'error' && (
            <>
              <div style={{
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem',
              }}>
                <MicOff size={48} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>
                {speechService.isSupported ? 'Microphone Error' : 'Voice Not Supported'}
              </h2>
              <p style={{ color: '#a1a1aa', margin: 0 }}>
                {speechService.isSupported
                  ? 'Could not access microphone. Check permissions.'
                  : 'Use Chrome or Edge for voice SOS.'}
              </p>
              <button onClick={handleManualActivate} style={{
                marginTop: '1.5rem', padding: '0.75rem 0', width: '100%',
                background: '#dc2626', color: '#fff', border: 'none',
                borderRadius: '999px', cursor: 'pointer', fontWeight: 700,
              }}>
                Retry
              </button>
              <button onClick={handleClose} style={{
                marginTop: '0.75rem', padding: '0.5rem',
                background: 'transparent', color: '#71717a', border: 'none', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </>
          )}
        </div>

        <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
      </>
    );
  };
export default VoiceEmergencyModal;
