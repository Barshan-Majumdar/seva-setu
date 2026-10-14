import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Sparkles, Loader2, CheckCircle2, AlertTriangle,
  RotateCcw, X, ArrowRight, Volume2, ShieldAlert, Check, ChevronDown, ChevronUp, Camera
} from 'lucide-react';
import api from '../../services/api';
import { speechService } from '../../services/SpeechService';

/**
 * Intelligent Client-Side Real-Time Extractor
 * Runs on every spoken syllable (< 5ms) to fill form inputs live as the user speaks.
 */
export const extractLiveFormFields = (text) => {
  if (!text || typeof text !== 'string') return { fields: {}, matches: {} };
  const lower = text.toLowerCase();
  const fields = {};
  const matches = {};

  // 1. Need Type
  if (/\b(medic|injur|patient|doctor|ambulance|blood|hospital|sick|daktar|aspatal|cikitsa|rogi|aahoto|dawa)\b/i.test(lower)) {
    fields.need_type = 'medical';
    const m = lower.match(/\b(medic[a-z]*|injur[a-z]*|patient[a-z]*|doctor|ambulance|blood|hospital|sick|daktar|aspatal|cikitsa|rogi|aahoto|dawa)\b/i);
    matches.need_type = { value: 'medical', matched_text: m ? m[0] : 'medical' };
  } else if (/\b(accident|crash|collision|hit|run\s*over|derail|crushed|blast|durghatana|durgotona|haadsa)\b/i.test(lower)) {
    fields.need_type = 'accidental';
    const m = lower.match(/\b(accident[a-z]*|crash|collision|hit|run\s*over|derail|crushed|blast|durghatana|durgotona|haadsa)\b/i);
    matches.need_type = { value: 'accidental', matched_text: m ? m[0] : 'accident' };
  } else if (/\b(food|water|drink|hungry|ration|meal|starv|bhat|pani|khana|khabar|jol|raashan)\b/i.test(lower)) {
    fields.need_type = 'food';
    const m = lower.match(/\b(food|water|drink[a-z]*|hungry|ration|meal|starv[a-z]*|bhat|pani|khana|khabar|jol|raashan)\b/i);
    matches.need_type = { value: 'food', matched_text: m ? m[0] : 'food & water' };
  } else if (/\b(shelter|tent|homeless|roof|tarpaulin|stay|ashray|basha|bari|ghar|chhat)\b/i.test(lower)) {
    fields.need_type = 'shelter';
    const m = lower.match(/\b(shelter|tent|homeless|roof|tarpaulin|stay|ashray|basha|bari|ghar|chhat)\b/i);
    matches.need_type = { value: 'shelter', matched_text: m ? m[0] : 'shelter' };
  } else if (/\b(rescue|trap|boat|stuck|submerged|flood|drown|bachao|uddhar|madad)\b/i.test(lower)) {
    fields.need_type = 'rescue';
    const m = lower.match(/\b(rescue|trap[a-z]*|boat|stuck|submerged|flood|drown[a-z]*|bachao|uddhar|madad)\b/i);
    matches.need_type = { value: 'rescue', matched_text: m ? m[0] : 'rescue' };
  }

  // 2. People Affected & Demographics (Children / Adults)
  const numWordMap = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'fifteen': 15, 'twenty': 20, 'fifty': 50, 'hundred': 100,
    'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5, 'chhah': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10
  };

  // 2.1 Children Count
  const childrenRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ek|do|teen|char|panch|chhah|saat|aath|nau|das)\s*(?:children|child|kids|kid|babies|baby|infants|infant|minors|minor|bacche|baccha|sishu|shishu|choto\s*bachha|chotobacha)/i;
  const cMatch = lower.match(childrenRegex);
  if (cMatch) {
    const rawVal = cMatch[1].toLowerCase();
    const count = numWordMap[rawVal] || parseInt(rawVal, 10);
    if (!isNaN(count)) {
      fields.children_count = String(count);
      matches.children_count = { value: count, matched_text: cMatch[0] };
    }
  }

  // 2.2 Adults Count
  const adultsRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ek|do|teen|char|panch|chhah|saat|aath|nau|das)\s*(?:adults|adult|grownups|grownup|men|women|elderly|seniors|boroder)/i;
  const aMatch = lower.match(adultsRegex);
  if (aMatch) {
    const rawVal = aMatch[1].toLowerCase();
    const count = numWordMap[rawVal] || parseInt(rawVal, 10);
    if (!isNaN(count)) {
      fields.adults_count = String(count);
      matches.adults_count = { value: count, matched_text: aMatch[0] };
    }
  }

  // 2.3 Pregnant Women Count
  const pregnantRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ek|do|teen|char|panch|chhah|saat|aath|nau|das)?\s*(?:pregnant\s*(?:women|woman|lady|mother|mothers)?|expecting\s*mothers?|garbhvati|garbhavati|prasuti|pettik)\b/i;
  const prMatch = lower.match(pregnantRegex);
  if (prMatch) {
    const rawVal = prMatch[1]?.toLowerCase();
    const count = (rawVal && numWordMap[rawVal]) ? numWordMap[rawVal] : (parseInt(rawVal, 10) || 1);
    fields.pregnant_count = String(count);
    matches.pregnant_count = { value: count, matched_text: prMatch[0] };
    if (!fields.adults_count || parseInt(fields.adults_count, 10) < count) {
      fields.adults_count = String(count);
    }
  }

  // 2.4 General People Affected
  const peopleRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|fifty|hundred|ek|do|teen|char|panch|chhah|saat|aath|nau|das)\s*(?:people|persons|injured|trapped|affected|victims|lok|manush|jon|log|vyakti)/i;
  const pMatch = lower.match(peopleRegex);
  if (pMatch) {
    const rawVal = pMatch[1].toLowerCase();
    const count = numWordMap[rawVal] || parseInt(rawVal, 10);
    if (!isNaN(count)) {
      fields.people_affected = String(count);
      matches.people_affected = { value: count, matched_text: pMatch[0] };
    }
  } else if (fields.children_count || fields.adults_count || fields.pregnant_count) {
    const total = (parseInt(fields.children_count, 10) || 0) + Math.max(parseInt(fields.adults_count, 10) || 0, parseInt(fields.pregnant_count, 10) || 0);
    if (total > 0) {
      fields.people_affected = String(total);
    }
  }

  // 3. Ward / Area
  const wardRegex = /(?:ward|ward\s*no\.?|ward\s*number)\s*([0-9]{1,4}[a-zA-Z]?)/i;
  const wMatch = lower.match(wardRegex);
  if (wMatch) {
    fields.ward = wMatch[1].toUpperCase();
    matches.ward = { value: fields.ward, matched_text: wMatch[0] };
  }

  // 4. District
  const districts = [
    'Kolkata', 'North 24 Parganas', 'South 24 Parganas', 'Howrah', 'Hooghly',
    'Nadia', 'Murshidabad', 'Purba Medinipur', 'Paschim Medinipur', 'Bankura',
    'Purulia', 'Birbhum', 'Malda', 'Uttar Dinajpur', 'Dakshin Dinajpur',
    'Jalpaiguri', 'Alipurduar', 'Cooch Behar', 'Darjeeling', 'Kalimpong',
    'Jhargram', 'Paschim Bardhaman', 'Purba Bardhaman'
  ];
  for (const d of districts) {
    if (new RegExp('\\b' + d.replace(/\s+/g, '\\s*') + '\\b', 'i').test(lower)) {
      fields.district = d;
      matches.district = { value: d, matched_text: d };
      break;
    }
  }

  // 5. Contact Number (10 digits)
  const phoneMatch = lower.replace(/[\s-]/g, '').match(/(?:\+?91)?([6-9]\d{9})/);
  if (phoneMatch) {
    fields.contact_number = phoneMatch[1];
    matches.contact_number = { value: phoneMatch[1], matched_text: phoneMatch[0] };
  }

  // 6. Disaster Zone Mode
  if (/\b(disaster|cyclone|flood|emergency|crisis|earthquake|landslide|tsunami|calamity|bipod|apotti)\b/i.test(lower)) {
    fields.is_disaster_zone = true;
    const m = lower.match(/\b(disaster|cyclone|flood|emergency|crisis|earthquake|landslide|tsunami|calamity|bipod|apotti)\b/i);
    matches.is_disaster_zone = { value: true, matched_text: m ? m[0] : 'disaster' };
  }

  // 7. Title / Headline & Description
  if (lower.trim().length > 6) {
    fields.description = text.trim();
    matches.description = { value: text.trim(), matched_text: text.trim() };

    const firstSentence = text.split(/[.,\n]/)[0].trim();
    const titleCandidate = firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
    fields.title = titleCandidate.charAt(0).toUpperCase() + titleCandidate.slice(1);
    matches.title = { value: fields.title, matched_text: firstSentence };
  }

  return { fields, matches };
};

export const TopVoiceFormBanner = ({ onApplyVoiceData, onClose, autoStart = false, onCapturePhoto }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [liveFields, setLiveFields] = useState({});

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Check speech recognition support
  const isSpeechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Auto-start listening if opened via button or trigger
  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => {
        startListening();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  // Listen for global activate event (e.g. from bottom mic or wake word)
  useEffect(() => {
    const handleGlobalTrigger = () => {
      setIsExpanded(true);
      startListening();
    };

    window.addEventListener('sevasetu:activate-voice-form', handleGlobalTrigger);
    return () => {
      window.removeEventListener('sevasetu:activate-voice-form', handleGlobalTrigger);
    };
  }, []);

  const startListening = () => {
    if (!isSpeechSupported) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      // 1. Release any background speech service to avoid mic collision
      try {
        speechService.stop();
      } catch (_) {}

      // 2. Clean up previous recognition session if active
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }

      setErrorMsg('');
      setParseResult(null);
      setTranscript('');
      setInterimText('');
      setLiveFields({});
      setIsExpanded(true);

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

        if (finalTrans) {
          setTranscript((prev) => {
            const combined = (prev + ' ' + finalTrans).trim();
            return combined;
          });
        }
        setInterimText(currentInterim);

        // ── LIVE FORM FILLING AS USER SPEAKS IN REAL TIME ──
        const fullLiveSpeech = (finalTrans ? (transcript + ' ' + finalTrans) : (transcript + ' ' + currentInterim)).trim();
        if (fullLiveSpeech) {
          const liveExtracted = extractLiveFormFields(fullLiveSpeech);
          setLiveFields(liveExtracted.fields);
          if (onApplyVoiceData && Object.keys(liveExtracted.fields).length > 0) {
            onApplyVoiceData({
              fields: liveExtracted.fields,
              matches: liveExtracted.matches,
              isLive: true
            });
          }
        }

        // Auto-analyze after 3.2 seconds of silence once we have speech
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
          const fullText = (transcript + ' ' + finalTrans + ' ' + currentInterim).trim();
          if (fullText) {
            handleAnalyze(fullText);
          }
        }, 3200);
      };

      recognition.onerror = (event) => {
        console.warn('[TopVoiceFormBanner] Speech Error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permission in your browser address bar.');
        } else if (event.error === 'audio-capture') {
          setErrorMsg('Microphone not detected. Please verify your microphone is plugged in.');
        } else if (event.error === 'network') {
          setErrorMsg('Network error during speech recognition. Please check your internet connection.');
        } else if (event.error === 'aborted' || event.error === 'no-speech') {
          // 'aborted' or 'no-speech' are normal browser lifecycle events (e.g. mic released or silence timeout)
          setErrorMsg('');
        } else {
          setErrorMsg(`Microphone error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('[TopVoiceFormBanner] Start Error:', err);
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

  const handleAnalyze = async (textToParse) => {
    const speechText = (textToParse || transcript || interimText).trim();
    if (!speechText) {
      setErrorMsg('No speech detected. Please speak into the microphone.');
      return;
    }

    stopListening();
    setIsAnalyzing(true);
    setErrorMsg('');

    let resultData = null;

    try {
      // Tier 1: Try configured API
      try {
        const response = await api.post('/needs/parse-voice-form', { transcript: speechText });
        if (response.data && response.data.success) {
          resultData = response.data;
        }
      } catch (primaryErr) {
        console.warn('[TopVoiceFormBanner] Primary API call failed, trying local direct fallback...', primaryErr?.message);
        
        // Tier 2: Try direct localhost port 5000 if primary is remote Render
        try {
          const directRes = await fetch('http://localhost:5000/api/needs/parse-voice-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: speechText })
          });
          if (directRes.ok) {
            const data = await directRes.json();
            if (data.success) {
              resultData = data;
            }
          }
        } catch (_) {}
      }

      // Tier 3: Client-side AI pattern engine fallback (instant, resilient, offline-ready)
      if (!resultData) {
        console.log('[TopVoiceFormBanner] Using client-side pattern engine');
        const localExtracted = extractLiveFormFields(speechText);
        resultData = {
          success: true,
          transcript: speechText,
          source: 'instant-local-parser',
          ...localExtracted.fields,
          field_matches: localExtracted.matches
        };
      }

      setParseResult(resultData);

      // Auto-apply fields directly into the form!
      const fieldsToUpdate = {};
      if (resultData.need_type) fieldsToUpdate.need_type = resultData.need_type;
      if (resultData.people_affected != null) fieldsToUpdate.people_affected = String(resultData.people_affected);
      if (resultData.district) fieldsToUpdate.district = resultData.district;
      if (resultData.ward) fieldsToUpdate.ward = resultData.ward;
      if (resultData.contact_number) fieldsToUpdate.contact_number = resultData.contact_number;
      if (resultData.title) fieldsToUpdate.title = resultData.title;
      if (resultData.description) fieldsToUpdate.description = resultData.description;
      if (resultData.is_disaster_zone != null) fieldsToUpdate.is_disaster_zone = Boolean(resultData.is_disaster_zone);

      if (onApplyVoiceData) {
        onApplyVoiceData({
          fields: fieldsToUpdate,
          matches: resultData.field_matches || {},
          rawTranscript: resultData.transcript || speechText,
          isLive: false
        });
      }
    } catch (err) {
      console.error('[TopVoiceFormBanner] Analyze Error:', err);
      // Fall back safely to client extractor
      const localExtracted = extractLiveFormFields(speechText);
      setParseResult({
        success: true,
        transcript: speechText,
        source: 'instant-local-parser',
        ...localExtracted.fields,
        field_matches: localExtracted.matches
      });
      if (onApplyVoiceData) {
        onApplyVoiceData({
          fields: localExtracted.fields,
          matches: localExtracted.matches,
          rawTranscript: speechText,
          isLive: false
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const fullDisplayTranscript = (transcript + ' ' + interimText).trim();

  return (
    <div style={{
      background: isListening
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(5, 150, 105, 0.08))'
        : 'linear-gradient(135deg, rgba(45, 97, 72, 0.05), rgba(5, 150, 105, 0.08))',
      border: isListening ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(5, 150, 105, 0.25)',
      borderRadius: '1.25rem',
      padding: '1.25rem 1.5rem',
      marginBottom: '1.75rem',
      boxShadow: isListening ? '0 8px 24px rgba(239, 68, 68, 0.12)' : '0 4px 16px rgba(5, 150, 105, 0.06)',
      transition: 'all 0.3s ease'
    }}>
      {/* ── Top Bar Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isListening ? '#dc2626' : '#059669',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isListening ? '0 0 0 8px rgba(220, 38, 38, 0.2)' : '0 4px 12px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0
            }}
            title={isListening ? 'Click to stop listening' : 'Click to speak and auto-fill form'}
          >
            {isListening ? (
              <MicOff style={{ width: 22, height: 22 }} />
            ) : (
              <Mic style={{ width: 22, height: 22 }} />
            )}
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isListening ? 'Listening to your voice...' : isAnalyzing ? 'Gemini AI Parsing Speech...' : 'Voice Auto-Fill Form'}
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: isListening ? '#dc2626' : '#059669',
                background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                padding: '2px 7px',
                borderRadius: '9999px'
              }}>
                <Sparkles style={{ width: 11, height: 11 }} />
                AI Powered
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              {isListening
                ? 'Speak naturally (e.g. disaster, people trapped, ward, phone number). Auto-fills the form below.'
                : 'Tap the mic or say "Hey Seva Setu" to fill all form inputs hands-free.'}
            </p>
          </div>
        </div>

        {/* Language Pills & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { code: 'en-IN', label: 'English' },
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
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.68rem',
                  fontWeight: language === lang.code ? 700 : 500,
                  borderRadius: '6px',
                  border: `1px solid ${language === lang.code ? '#059669' : '#cbd5e1'}`,
                  background: language === lang.code ? 'rgba(5, 150, 105, 0.1)' : '#ffffff',
                  color: language === lang.code ? '#059669' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {isListening && (
            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !fullDisplayTranscript}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
              }}
            >
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              <span>Done & Fill</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px'
            }}
            title={isExpanded ? 'Collapse voice bar' : 'Expand voice bar'}
          >
            {isExpanded ? <ChevronUp style={{ width: 18, height: 18 }} /> : <ChevronDown style={{ width: 18, height: 18 }} />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopListening();
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
              title="Close voice filler"
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Collapsible Body ── */}
      {isExpanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(226, 232, 240, 0.7)' }}>
          {/* Active Listening Transcript Box */}
          {isListening && (
            <div style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '0.9rem 1.1rem',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              marginBottom: '0.75rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              fontSize: '0.9rem',
              color: fullDisplayTranscript ? '#0f172a' : '#94a3b8',
              fontStyle: fullDisplayTranscript ? 'normal' : 'italic',
              lineHeight: 1.5
            }}>
              {fullDisplayTranscript || 'Speak your incident details aloud...'}
            </div>
          )}

          {/* Analyzing Spinner */}
          {isAnalyzing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              padding: '1.25rem',
              background: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              marginBottom: '0.75rem'
            }}>
              <Loader2 style={{ width: 22, height: 22, color: '#059669', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                Gemini AI is parsing speech and matching words to form fields...
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#b91c1c',
              fontSize: '0.78rem',
              marginBottom: '0.75rem'
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── TRANSPARENCY CARD: WHICH FIELD WAS FILLED WITH WHICH WORD ── */}
          {parseResult && (
            <div style={{
              background: '#ffffff',
              borderRadius: '0.9rem',
              padding: '1.1rem',
              border: '1.5px solid rgba(5, 150, 105, 0.3)',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: '#059669' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065f46' }}>
                    Auto-Filled Into Form Below: Word-to-Field Breakdown
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={startListening}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#64748b',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.25rem 0.6rem',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw style={{ width: 12, height: 12 }} />
                    Speak Again
                  </button>

                  <button
                    type="button"
                    onClick={() => setParseResult(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#059669',
                      background: 'rgba(5, 150, 105, 0.08)',
                      border: '1px solid rgba(5, 150, 105, 0.25)',
                      borderRadius: '6px',
                      padding: '0.25rem 0.6rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Check style={{ width: 12, height: 12 }} />
                    Done Reviewing
                  </button>
                </div>
              </div>

              {/* What was spoken */}
              <div style={{
                background: '#f8fafc',
                borderLeft: '3px solid #059669',
                padding: '0.5rem 0.75rem',
                borderRadius: '0 6px 6px 0',
                marginBottom: '0.85rem'
              }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  What You Spoke:
                </span>
                <p style={{ fontSize: '0.8rem', color: '#0f172a', fontStyle: 'italic', margin: '0.15rem 0 0 0', lineHeight: 1.4 }}>
                  "{parseResult.transcript}"
                </p>
              </div>

              {/* Field mapping grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.5rem'
              }}>
                {[
                  {
                    label: 'Headline',
                    value: parseResult.title,
                    matched: parseResult.field_matches?.title?.matched_text,
                    color: '#475569'
                  },
                  {
                    label: 'Need Classification',
                    value: parseResult.need_type?.toUpperCase(),
                    matched: parseResult.field_matches?.need_type?.matched_text,
                    color: '#059669'
                  },
                  {
                    label: 'People Affected',
                    value: parseResult.people_affected != null ? `${parseResult.people_affected} people` : null,
                    matched: parseResult.field_matches?.people_affected?.matched_text,
                    color: '#2563eb'
                  },
                  {
                    label: 'District',
                    value: parseResult.district,
                    matched: parseResult.field_matches?.district?.matched_text,
                    color: '#d97706'
                  },
                  {
                    label: 'Area / Ward',
                    value: parseResult.ward,
                    matched: parseResult.field_matches?.ward?.matched_text,
                    color: '#7c3aed'
                  },
                  {
                    label: 'Contact Number',
                    value: parseResult.contact_number,
                    matched: parseResult.field_matches?.contact_number?.matched_text,
                    color: '#0891b2'
                  },
                  {
                    label: 'Disaster Mode',
                    value: parseResult.is_disaster_zone ? 'ACTIVE (Severe)' : 'Normal',
                    matched: parseResult.field_matches?.is_disaster_zone?.matched_text,
                    color: parseResult.is_disaster_zone ? '#dc2626' : '#94a3b8'
                  }
                ].filter(item => item.value).map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569' }}>
                        {item.label}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: item.color,
                        background: '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        border: `1px solid ${item.color}25`
                      }}>
                        {item.value}
                      </span>
                    </div>

                    {item.matched && (
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.15rem' }}>
                        Matched from:{' '}
                        <span style={{ color: '#065f46', fontWeight: 600, background: 'rgba(5, 150, 105, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                          "{item.matched}"
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Option: Capture Live Photo after incident is described ── */}
              {onCapturePhoto && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.9rem 1.1rem',
                  background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08), rgba(16, 185, 129, 0.12))',
                  border: '1.5px solid rgba(5, 150, 105, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '8px',
                      background: '#059669', color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
                    }}>
                      <Camera style={{ width: 17, height: 17 }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#065f46', display: 'block' }}>
                        Incident Described! Next: Capture Live Photo
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Take a real-time camera photo with verified GPS watermark.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onCapturePhoto}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 1.1rem',
                      background: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <Camera style={{ width: 15, height: 15 }} />
                    Capture Live Photo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopVoiceFormBanner;
