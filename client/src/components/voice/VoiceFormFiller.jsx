import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Sparkles, Loader2, CheckCircle2, AlertTriangle,
  RotateCcw, X, ArrowRight, Volume2, ShieldAlert, Check
} from 'lucide-react';
import api from '../../services/api';

export const VoiceFormFiller = ({ onApplyVoiceData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Check speech recognition support
  const isSpeechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize SpeechRecognition
  const startListening = () => {
    if (!isSpeechSupported) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setErrorMsg('');
      setParseResult(null);
      setTranscript('');
      setInterimText('');

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let currentInterim = '';
        let finalTrans = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTrans += result[0].transcript + ' ';
          } else {
            currentInterim += result[0].transcript;
          }
        }

        setTranscript(finalTrans.trim());
        setInterimText(currentInterim);

        // Reset silence timer: auto-stop after 3.5 seconds of silence once we have text
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
        }, 3500);
      };

      recognition.onerror = (event) => {
        console.warn('[VoiceFormFiller] Speech Recognition Error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permission in your browser.');
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Microphone error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('[VoiceFormFiller] Start Error:', err);
      setErrorMsg('Failed to initialize microphone.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  };

  // Trigger AI parsing when user finishes speaking
  const handleAnalyze = async (textToParse) => {
    const speechText = (textToParse || transcript || interimText).trim();
    if (!speechText) {
      setErrorMsg('No speech detected. Please speak clearly into the microphone.');
      return;
    }

    stopListening();
    setIsAnalyzing(true);
    setErrorMsg('');

    try {
      const response = await api.post('/needs/parse-voice-form', { transcript: speechText });
      if (response.data && response.data.success) {
        setParseResult(response.data);
      } else {
        throw new Error(response.data?.error || 'Failed to extract form fields');
      }
    } catch (err) {
      console.error('[VoiceFormFiller] Analyze Error:', err);
      setErrorMsg(err.response?.data?.details || err.message || 'AI parsing failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!parseResult) return;

    const fieldsToUpdate = {};
    if (parseResult.need_type) fieldsToUpdate.need_type = parseResult.need_type;
    if (parseResult.people_affected != null) fieldsToUpdate.people_affected = String(parseResult.people_affected);
    if (parseResult.district) fieldsToUpdate.district = parseResult.district;
    if (parseResult.ward) fieldsToUpdate.ward = parseResult.ward;
    if (parseResult.contact_number) fieldsToUpdate.contact_number = parseResult.contact_number;
    if (parseResult.title) fieldsToUpdate.title = parseResult.title;
    if (parseResult.description) fieldsToUpdate.description = parseResult.description;
    if (parseResult.is_disaster_zone != null) fieldsToUpdate.is_disaster_zone = Boolean(parseResult.is_disaster_zone);

    if (onApplyVoiceData) {
      onApplyVoiceData({
        fields: fieldsToUpdate,
        matches: parseResult.field_matches || {},
        rawTranscript: parseResult.transcript || transcript
      });
    }

    setIsOpen(false);
    setParseResult(null);
    setTranscript('');
    setInterimText('');
  };

  const handleClose = () => {
    stopListening();
    setIsOpen(false);
    setParseResult(null);
    setErrorMsg('');
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const fullDisplayTranscript = (transcript + ' ' + interimText).trim();

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          startListening();
        }}
        className="voice-fill-trigger-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.9rem',
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, rgba(45, 97, 72, 0.12), rgba(5, 150, 105, 0.18))',
          border: '1px solid rgba(5, 150, 105, 0.3)',
          color: '#065f46',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
        }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#059669',
          color: '#ffffff'
        }}>
          <Mic style={{ width: 12, height: 12 }} />
        </span>
        <span>Fill with Voice</span>
      </button>

      {/* ── Voice Assistant Modal ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '38rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: 'rgba(5, 150, 105, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}>
                  <Sparkles style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Voice-Based Form Assistant
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Speak naturally. Gemini AI will match your words to form fields.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Language Selector & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[
                    { code: 'en-IN', label: 'English (IN)' },
                    { code: 'hi-IN', label: 'Hindi' },
                    { code: 'bn-IN', label: 'Bengali' }
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code);
                        if (isListening) {
                          stopListening();
                          setTimeout(startListening, 200);
                        }
                      }}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.7rem',
                        fontWeight: language === lang.code ? 700 : 500,
                        borderRadius: '9999px',
                        border: `1px solid ${language === lang.code ? '#059669' : '#e2e8f0'}`,
                        background: language === lang.code ? 'rgba(5, 150, 105, 0.08)' : '#f8fafc',
                        color: language === lang.code ? '#059669' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isListening ? '#10b981' : isAnalyzing ? '#f59e0b' : '#94a3b8',
                    animation: isListening ? 'pulse 1.5s infinite' : 'none'
                  }} />
                  <span style={{ fontWeight: 600, color: isListening ? '#059669' : '#64748b' }}>
                    {isListening ? 'Listening...' : isAnalyzing ? 'Gemini AI Parsing...' : 'Ready'}
                  </span>
                </div>
              </div>

              {/* Mic Visualizer / Button */}
              {!parseResult && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem 1rem',
                  borderRadius: '1rem',
                  background: isListening
                    ? 'linear-gradient(180deg, rgba(5, 150, 105, 0.05) 0%, rgba(5, 150, 105, 0.01) 100%)'
                    : '#f8fafc',
                  border: isListening ? '1.5px dashed rgba(5, 150, 105, 0.35)' : '1px dashed #cbd5e1',
                  marginBottom: '1rem'
                }}>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: isListening ? '#dc2626' : '#059669',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isListening ? '0 0 0 10px rgba(220, 38, 38, 0.15)' : '0 10px 20px -5px rgba(5, 150, 105, 0.3)',
                      transition: 'all 0.25s'
                    }}
                  >
                    {isListening ? (
                      <MicOff style={{ width: 28, height: 28 }} />
                    ) : (
                      <Mic style={{ width: 28, height: 28 }} />
                    )}
                  </button>

                  <p style={{ marginTop: '1rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', textAlign: 'center' }}>
                    {isListening ? 'Tap mic to pause, or click "Analyze & Fill"' : 'Tap microphone to speak'}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', maxWidth: '24rem', marginTop: '0.2rem' }}>
                    Example: <i>"Major flood in Ward 102 South 24 Parganas. 8 people trapped with no food or drinking water. Call me at 9876543210."</i>
                  </p>
                </div>
              )}

              {/* Transcript Box */}
              {!parseResult && (
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  minHeight: '4.5rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Live Transcript
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: fullDisplayTranscript ? '#0f172a' : '#94a3b8',
                    fontStyle: fullDisplayTranscript ? 'normal' : 'italic',
                    lineHeight: 1.5,
                    margin: 0
                  }}>
                    {fullDisplayTranscript || 'Your spoken words will appear here in real-time...'}
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Analyzing State */}
              {isAnalyzing && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2.5rem 1rem',
                  gap: '0.8rem'
                }}>
                  <Loader2 style={{ width: 36, height: 36, color: '#059669', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Gemini AI is parsing your crisis report...
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Extracting location, headcount, classification, and contact info
                  </p>
                </div>
              )}

              {/* ── PARSED RESULTS & TRANSPARENCY BREAKDOWN TRAY ── */}
              {parseResult && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    background: 'rgba(5, 150, 105, 0.06)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(5, 150, 105, 0.18)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: '#059669' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46' }}>
                        Voice Parsed Successfully
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setParseResult(null);
                        startListening();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#64748b',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.3rem 0.6rem',
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw style={{ width: 12, height: 12 }} />
                      Re-record
                    </button>
                  </div>

                  {/* Spoken Quote */}
                  <div style={{
                    background: '#f8fafc',
                    borderLeft: '3px solid #059669',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '0 0.5rem 0.5rem 0',
                    marginBottom: '1.25rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Original Speech:
                    </span>
                    <p style={{ fontSize: '0.82rem', color: '#1e293b', fontStyle: 'italic', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                      "{parseResult.transcript}"
                    </p>
                  </div>

                  {/* Word-to-Field Mapping Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                      Field Extraction & Word Mapping Breakdown:
                    </div>

                    {[
                      {
                        key: 'need_type',
                        label: 'Need Classification',
                        value: parseResult.need_type ? parseResult.need_type.toUpperCase() : 'None',
                        matched: parseResult.field_matches?.need_type?.matched_text || '',
                        badgeColor: '#059669',
                      },
                      {
                        key: 'people_affected',
                        label: 'People Affected',
                        value: parseResult.people_affected != null ? `${parseResult.people_affected} people` : 'Not specified',
                        matched: parseResult.field_matches?.people_affected?.matched_text || '',
                        badgeColor: '#2563eb',
                      },
                      {
                        key: 'district',
                        label: 'District',
                        value: parseResult.district || 'Not specified',
                        matched: parseResult.field_matches?.district?.matched_text || '',
                        badgeColor: '#d97706',
                      },
                      {
                        key: 'ward',
                        label: 'Area / Ward',
                        value: parseResult.ward || 'Not specified',
                        matched: parseResult.field_matches?.ward?.matched_text || '',
                        badgeColor: '#7c3aed',
                      },
                      {
                        key: 'contact_number',
                        label: 'Contact Number',
                        value: parseResult.contact_number || 'Not detected',
                        matched: parseResult.field_matches?.contact_number?.matched_text || '',
                        badgeColor: '#0891b2',
                      },
                      {
                        key: 'title',
                        label: 'Headline',
                        value: parseResult.title || 'Emergency Need',
                        matched: parseResult.field_matches?.title?.matched_text || '',
                        badgeColor: '#475569',
                      },
                      {
                        key: 'is_disaster_zone',
                        label: 'Disaster Mode',
                        value: parseResult.is_disaster_zone ? 'ACTIVE (Severe)' : 'Normal',
                        matched: parseResult.field_matches?.is_disaster_zone?.matched_text || '',
                        badgeColor: parseResult.is_disaster_zone ? '#dc2626' : '#94a3b8',
                      }
                    ].map((item) => (
                      <div
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                              {item.label}
                            </span>
                            <ArrowRight style={{ width: 12, height: 12, color: '#94a3b8' }} />
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: item.badgeColor,
                              background: '#ffffff',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: `1px solid ${item.badgeColor}25`
                            }}>
                              {item.value}
                            </span>
                          </div>

                          {item.matched && (
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              <span style={{ fontWeight: 600 }}>Matched words:</span>{' '}
                              <span style={{ color: '#0f172a', background: 'rgba(5, 150, 105, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                "{item.matched}"
                              </span>
                            </div>
                          )}
                        </div>

                        <div style={{ color: '#059669', flexShrink: 0 }}>
                          <Check style={{ width: 16, height: 16 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              {!parseResult ? (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzing || !fullDisplayTranscript}
                    onClick={() => handleAnalyze()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 1.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      background: fullDisplayTranscript ? '#059669' : '#94a3b8',
                      color: '#ffffff',
                      cursor: fullDisplayTranscript ? 'pointer' : 'not-allowed',
                      boxShadow: fullDisplayTranscript ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none'
                    }}
                  >
                    {isAnalyzing ? (
                      <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Sparkles style={{ width: 14, height: 14 }} />
                    )}
                    <span>Analyze & Extract</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setParseResult(null);
                      startListening();
                    }}
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Retry Speech
                  </button>

                  <button
                    type="button"
                    onClick={handleApply}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.4rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      background: '#059669',
                      color: '#ffffff',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
                    }}
                  >
                    <CheckCircle2 style={{ width: 16, height: 16 }} />
                    <span>Apply to Form</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceFormFiller;
