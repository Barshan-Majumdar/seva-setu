import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Camera, SwitchCamera, X, Check, Loader2,
  MapPin, AlertTriangle, Send, RotateCcw, CheckCircle2, ChevronRight, ChevronLeft
} from 'lucide-react';
import { VoiceFeedback } from '../../services/VoiceFeedback';
import { extractLiveFormFields } from './TopVoiceFormBanner';
import { speechService } from '../../services/SpeechService';

/**
 * VoiceVideoAssistantModal
 * A dedicated, self-contained div modal where the entire voice + video + submit flow happens:
 * 1. Speak incident details (live transcription & AI field extraction)
 * 2. Live camera viewfinder & GPS photo capture (inside this same div)
 * 3. Photo preview + Say "Submit" voice auto-submission (inside this same div)
 */
const mergeTranscripts = (base, current) => {
  const b = (base || '').trim();
  const c = (current || '').trim();
  if (!b) return c;
  if (!c) return b;
  if (b.endsWith(c) || b === c) return b;
  if (c.startsWith(b)) return c;
  return `${b} ${c}`;
};

export const VoiceVideoAssistantModal = ({
  isOpen,
  onClose,
  onResetForm,
  onApplyData,
  onSubmitForm,
  formData = {},
  isOnline = true,
  isSubmitting = false,
  submitSuccess = false,
  submitError = '',
}) => {
  // Flow steps: 'voice' | 'camera' | 'submit' | 'submitting' | 'success'
  const [step, setStep] = useState('voice');

  // Step 1: Voice state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [extractedFields, setExtractedFields] = useState({});
  const recognitionRef = useRef(null);
  const baseTranscriptRef = useRef('');
  const sessionFinalRef = useRef('');
  const transcriptRef = useRef('');
  const interimTextRef = useRef('');
  const extractedFieldsRef = useRef({});
  const isManuallyStoppedRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const isOpenRef = useRef(isOpen);
  const stepRef = useRef(step);
  const onApplyDataRef = useRef(onApplyData);
  const formDataRef = useRef(formData);
  const languageRef = useRef(language);

  // Keep references synchronized
  useEffect(() => {
    isOpenRef.current = isOpen;
    stepRef.current = step;
    onApplyDataRef.current = onApplyData;
    formDataRef.current = formData;
    languageRef.current = language;
  });

  // Step 2: Camera state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [location, setLocation] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraCount, setCameraCount] = useState(0);

  // Step 3: Submission state
  const [localSubmitError, setLocalSubmitError] = useState('');
  const [localSubmitSuccess, setLocalSubmitSuccess] = useState(false);
  const lastSpokenErrorRef = useRef('');

  // Sync external success from parent
  useEffect(() => {
    if (submitSuccess) {
      setLocalSubmitSuccess(true);
      setStep('success');
      VoiceFeedback.speak('Report submitted successfully.');
      const t = setTimeout(() => {
        onClose();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sevasetu:voice-form-closed'));
        }
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [submitSuccess, onClose]);

  // Sync external error from parent and read it aloud
  useEffect(() => {
    const activeErr = submitError || localSubmitError;
    if (activeErr && activeErr !== lastSpokenErrorRef.current && (step === 'submitting' || step === 'submit')) {
      lastSpokenErrorRef.current = activeErr;
      setStep('submit');
      const speechText = typeof activeErr === 'string'
        ? activeErr.replace(/[{}"]/g, '').replace(/\\n/g, '. ').trim()
        : 'Submission failed. Please check details and try again.';
      VoiceFeedback.speak(speechText);
    }
  }, [submitError, localSubmitError, step]);

  // ══════════════════════════════════════════════════════
  // 1. STEP 1: VOICE RECOGNITION SETUP
  // ══════════════════════════════════════════════════════
  const stopVoiceListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleProceedToCamera = useCallback(() => {
    isManuallyStoppedRef.current = true;
    stopVoiceListening();
    const currentSpeech = (baseTranscriptRef.current + ' ' + sessionFinalRef.current + ' ' + interimTextRef.current).trim();
    const fieldsToApply = { ...extractedFieldsRef.current };
    if (currentSpeech) {
      if (!fieldsToApply.title) {
        const firstSentence = currentSpeech.split(/[.,\n]/)[0].trim();
        fieldsToApply.title = firstSentence.length > 50 ? firstSentence.slice(0, 50) + '...' : firstSentence;
      }
      if (!fieldsToApply.description) {
        fieldsToApply.description = currentSpeech;
      }
      if (!fieldsToApply.district && !formDataRef.current?.district) {
        fieldsToApply.district = 'Kolkata';
      }
      if (!fieldsToApply.ward && !formDataRef.current?.ward) {
        fieldsToApply.ward = '1';
      }
      setExtractedFields(fieldsToApply);
      if (onApplyDataRef.current) {
        onApplyDataRef.current(fieldsToApply, null, null);
      }
    }
    setStep('camera');
    VoiceFeedback.speak('Incident details recorded. Please capture a live photo of the incident.');
  }, [stopVoiceListening]);

  const startVoiceListening = useCallback(() => {
    isManuallyStoppedRef.current = false;
    clearTimeout(restartTimeoutRef.current);
    setIsListening(true);

    // Stop background wake word listener to avoid Chromium audio conflict
    if (speechService && typeof speechService.stop === 'function') {
      try { speechService.stop(); } catch (_) {}
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[VoiceVideoModal] Speech Recognition not supported in this browser.');
      setIsListening(false);
      return;
    }

    const launchRecognition = () => {
      if (isManuallyStoppedRef.current || !isOpenRef.current || stepRef.current !== 'voice') {
        setIsListening(false);
        return;
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageRef.current || 'en-IN';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let currentSessionFinal = '';
          let currentSessionInterim = '';

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              currentSessionFinal += res[0].transcript + ' ';
            } else {
              currentSessionInterim += res[0].transcript;
            }
          }

          currentSessionFinal = currentSessionFinal.trim();
          sessionFinalRef.current = currentSessionFinal;

          const totalFinal = mergeTranscripts(baseTranscriptRef.current, currentSessionFinal);
          transcriptRef.current = totalFinal;
          setTranscript(totalFinal);

          interimTextRef.current = currentSessionInterim;
          setInterimText(currentSessionInterim);

          const fullSpeech = (totalFinal + ' ' + currentSessionInterim).trim();
          if (fullSpeech) {
            const parsed = extractLiveFormFields(fullSpeech);
            extractedFieldsRef.current = parsed.fields;
            setExtractedFields(parsed.fields);
            if (onApplyDataRef.current && Object.keys(parsed.fields).length > 0) {
              onApplyDataRef.current(parsed.fields, null, null);
            }

            // Voice trigger for advancing to camera:
            if (/\b(open\s*camera|take\s*photo|camera|capture|tasveer|chobi)\b/i.test(fullSpeech.toLowerCase())) {
              handleProceedToCamera();
            }
          }
        };

        recognition.onerror = (err) => {
          const errCode = err?.error;
          console.warn('[VoiceVideoModal] Speech error:', errCode);
          if (errCode === 'no-speech' || errCode === 'aborted') {
            // Normal silence timeout or browser audio cycle — do not terminate listening state
            return;
          }
          // On fatal errors like 'not-allowed', stop to prevent infinite error loops
          isManuallyStoppedRef.current = true;
          clearTimeout(restartTimeoutRef.current);
          setIsListening(false);
          if (errCode === 'not-allowed') {
            VoiceFeedback.speak('Microphone access denied. Please allow microphone in browser address bar.');
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;

          // Commit current session's final text into baseTranscriptRef
          if (sessionFinalRef.current) {
            baseTranscriptRef.current = mergeTranscripts(baseTranscriptRef.current, sessionFinalRef.current);
            sessionFinalRef.current = '';
          }
          interimTextRef.current = '';
          setInterimText('');

          // Keep continuously listening seamlessly during voice step without toggling UI to green
          if (!isManuallyStoppedRef.current && isOpenRef.current && stepRef.current === 'voice') {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = setTimeout(() => {
              if (!isManuallyStoppedRef.current && isOpenRef.current && stepRef.current === 'voice') {
                launchRecognition();
              }
            }, 100);
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('[VoiceVideoModal] Speech start error:', err);
        if (!isManuallyStoppedRef.current && isOpenRef.current && stepRef.current === 'voice') {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManuallyStoppedRef.current && isOpenRef.current && stepRef.current === 'voice') {
              launchRecognition();
            }
          }, 250);
        } else {
          setIsListening(false);
        }
      }
    };

    // Buffer 100ms so Chromium cleanly releases previous microphone session
    restartTimeoutRef.current = setTimeout(launchRecognition, 100);
  }, [handleProceedToCamera]);

  // Start listening automatically when modal opens in 'voice' step, or when language switches
  useEffect(() => {
    if (isOpen && step === 'voice') {
      startVoiceListening();
    } else {
      stopVoiceListening();
    }
    return () => {
      stopVoiceListening();
    };
  }, [isOpen, step, language, startVoiceListening, stopVoiceListening]);

  // ══════════════════════════════════════════════════════
  // 2. STEP 2: CAMERA HARDWARE & GPS SETUP
  // ══════════════════════════════════════════════════════
  const killCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      console.log('[VoiceVideoModal:Camera] Hardware released.');
    }
  }, []);

  const openCamera = useCallback(async (mode) => {
    killCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('[VoiceVideoModal:Camera] Camera error:', err);
    }
  }, [killCamera]);

  // Enumerate cameras & continuous GPS
  useEffect(() => {
    if (step === 'camera') {
      (async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCameraCount(devices.filter((d) => d.kind === 'videoinput').length);
        } catch (_) {
          setCameraCount(1);
        }
      })();

      let gpsWatchId = null;
      if ('geolocation' in navigator) {
        gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => setLocation({
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6),
            accuracy: pos.coords.accuracy.toFixed(1)
          }),
          (err) => console.warn('[VoiceVideoModal:GPS] Error:', err.message),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }

      openCamera(facingMode);

      return () => {
        killCamera();
        if (gpsWatchId != null) navigator.geolocation.clearWatch(gpsWatchId);
      };
    }
  }, [step, facingMode, openCamera, killCamera]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo with EXIF GPS injection
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    try {
      if (location) {
        const piexifModule = await import('piexifjs');
        const piexif = piexifModule.default || piexifModule;

        const zeroth = {};
        const exif = {};
        const gps = {};

        const toRational = (number) => {
          const absolute = Math.abs(number);
          const d = Math.floor(absolute);
          const m = Math.floor((absolute - d) * 60);
          const s = Math.round((absolute - d - m / 60) * 3600 * 100);
          return [[d, 1], [m, 1], [s, 100]];
        };

        gps[piexif.GPSIFD.GPSLatitudeRef] = parseFloat(location.lat) >= 0 ? 'N' : 'S';
        gps[piexif.GPSIFD.GPSLatitude] = toRational(parseFloat(location.lat));
        gps[piexif.GPSIFD.GPSLongitudeRef] = parseFloat(location.lng) >= 0 ? 'E' : 'W';
        gps[piexif.GPSIFD.GPSLongitude] = toRational(parseFloat(location.lng));
        gps[piexif.GPSIFD.GPSVersionID] = [2, 2, 0, 0];

        const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
        const exifStr = piexif.dump(exifObj);
        const newImgData = piexif.insert(exifStr, dataUrl);

        const parts = newImgData.split(',');
        const byteString = atob(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], `sevasetu_geotagged_${Date.now()}.jpg`, { type: 'image/jpeg' });

        setCapturedPhoto({ file, hasGps: true, previewUrl: URL.createObjectURL(file) });
        killCamera();
        setIsCapturing(false);

        if (onApplyData) {
          onApplyData(extractedFields, file, location);
        }
        setStep('submit');
        return;
      }
      throw new Error('No GPS lock');
    } catch (err) {
      console.warn('[VoiceVideoModal] Capturing without EXIF GPS:', err.message);
      canvas.toBlob((blob) => {
        const file = new File([blob], `sevasetu_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedPhoto({ file, hasGps: false, previewUrl: URL.createObjectURL(file) });
        killCamera();
        setIsCapturing(false);

        if (onApplyData) {
          onApplyData(extractedFields, file, location);
        }
        setStep('submit');
      }, 'image/jpeg', 0.9);
    }
  };

  // ══════════════════════════════════════════════════════
  // 3. STEP 3: "SAY SUBMIT" AUTO-SUBMIT VOICE LISTENER
  // ══════════════════════════════════════════════════════
  const executeSubmission = useCallback(async () => {
    setStep('submitting');
    setLocalSubmitError('');
    lastSpokenErrorRef.current = '';
    VoiceFeedback.speak('Submitting report now...');

    try {
      if (onSubmitForm) {
        await onSubmitForm();
      }
    } catch (err) {
      console.error('[VoiceVideoModal] Submission failed:', err);
      const errDetail = err?.response?.data?.errors?.join('. ') || err?.response?.data?.message || err?.message || 'Submission failed. Please try again.';
      setLocalSubmitError(errDetail);
      setStep('submit');
      lastSpokenErrorRef.current = errDetail;
      const speechText = typeof errDetail === 'string'
        ? errDetail.replace(/[{}"]/g, '').replace(/\\n/g, '. ').trim()
        : 'Submission failed. Please check details and try again.';
      VoiceFeedback.speak(speechText);
    }
  }, [onSubmitForm]);

  useEffect(() => {
    if (step !== 'submit') return;

    // Only prompt "Photo captured" if there is no error message currently displayed
    if (!submitError && !localSubmitError) {
      VoiceFeedback.speak("Photo captured! Say 'Submit' to send your report.");
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition;
    let isCancelled = false;

    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        const lower = text.toLowerCase().trim();
        console.log('[VoiceVideoModal:SaySubmit] Heard:', lower);

        // Match English, Hindi, Bengali submit keywords
        if (/\b(submit|jama|bhejo|bhej|pathao|confirm|send)\b/i.test(lower) && !isCancelled) {
          isCancelled = true;
          try { recognition.stop(); } catch (_) {}
          executeSubmission();
        }
      };

      recognition.onerror = (err) => {
        console.warn('[VoiceVideoModal:SaySubmit] Speech error:', err?.error);
      };

      recognition.onend = () => {
        if (!isCancelled && step === 'submit') {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[VoiceVideoModal:SaySubmit] Start error:', err);
    }

    return () => {
      isCancelled = true;
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
    };
  }, [step, language, executeSubmission]);

  const fullDisplayTranscript = (transcript + ' ' + interimText).trim();

  // Comprehensive Session Reset: wipes all voice, camera, photo, and error artifacts
  const resetSession = useCallback(() => {
    // 1. Teardown mic, camera, and all audio playback immediately
    stopVoiceListening();
    killCamera();
    VoiceFeedback.stop();

    // 2. Reset step back to voice
    setStep('voice');

    // 3. Clear speech & transcription state
    baseTranscriptRef.current = '';
    sessionFinalRef.current = '';
    transcriptRef.current = '';
    interimTextRef.current = '';
    extractedFieldsRef.current = {};
    setTranscript('');
    setInterimText('');
    setExtractedFields({});
    isManuallyStoppedRef.current = false;
    clearTimeout(restartTimeoutRef.current);

    // 4. Clear photo and GPS state
    setCapturedPhoto(null);
    setLocation(null);
    setIsCapturing(false);

    // 5. Clear submission & error state
    setLocalSubmitError('');
    setLocalSubmitSuccess(false);
    lastSpokenErrorRef.current = '';

    // 6. Notify parent to wipe previous form data, imageFile, and error
    if (onResetForm) {
      onResetForm();
    }
  }, [stopVoiceListening, killCamera, onResetForm]);

  // Handle closing modal
  const handleModalClose = useCallback(() => {
    resetSession();
    if (onClose) onClose();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sevasetu:voice-form-closed'));
    }
  }, [resetSession, onClose]);

  // Clean session reset whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('voice');
      baseTranscriptRef.current = '';
      sessionFinalRef.current = '';
      transcriptRef.current = '';
      interimTextRef.current = '';
      extractedFieldsRef.current = {};
      setTranscript('');
      setInterimText('');
      setExtractedFields({});
      setCapturedPhoto(null);
      setLocation(null);
      setIsCapturing(false);
      setLocalSubmitError('');
      setLocalSubmitSuccess(false);
      lastSpokenErrorRef.current = '';
      isManuallyStoppedRef.current = false;
      if (onResetForm) onResetForm();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sevasetu:voice-form-opened'));
      }
      startVoiceListening();
    } else {
      resetSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sevasetu:voice-form-closed'));
      }
    }
  }, [isOpen, onResetForm, resetSession, startVoiceListening]);

  // Hardware Back / Browser Back / Escape Key Handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Support browser / Android back button to cleanly close & reset
    const handlePopState = () => {
      handleModalClose();
    };
    try {
      window.history.pushState({ sevasetuVoiceModal: true }, '');
    } catch (_) {}
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, handleModalClose]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
        background: '#ffffff',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '35rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh',
      }}>
        {/* ── Modal Header with Stepper ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: '#059669',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}>
                Voice Assistant
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                {step === 'voice' && 'Step 1 of 3: Speak Details'}
                {step === 'camera' && 'Step 2 of 3: Live GPS Photo'}
                {(step === 'submit' || step === 'submitting' || step === 'success') && 'Step 3 of 3: Voice Submit'}
              </span>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0 0' }}>
              {step === 'voice' && 'Speak Your Incident Details'}
              {step === 'camera' && 'Capture Live Incident Photo'}
              {step === 'submit' && 'Photo Verified — Say "Submit"'}
              {step === 'submitting' && 'Transmitting Incident Report...'}
              {step === 'success' && 'Report Successfully Submitted!'}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            title="Close Assistant"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* ── STEP 1: VOICE INCIDENT DESCRIPTION ── */}
        {step === 'voice' && (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Listening Waveform Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isListening 
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(244, 63, 94, 0.12))' 
                : 'linear-gradient(135deg, rgba(5, 150, 105, 0.08), rgba(16, 185, 129, 0.14))',
              border: isListening ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1.5px solid rgba(5, 150, 105, 0.3)',
              borderRadius: '12px',
              padding: '0.85rem 1.1rem',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isListening) {
                      stopVoiceListening();
                    } else {
                      startVoiceListening();
                    }
                  }}
                  title={isListening ? 'Click to pause listening' : 'Click to start speaking'}
                  aria-label={isListening ? 'Pause microphone' : 'Start microphone'}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: isListening ? '#dc2626' : '#059669',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isListening ? '0 0 0 6px rgba(220, 38, 38, 0.25)' : '0 2px 8px rgba(5, 150, 105, 0.25)',
                    animation: isListening ? 'pulse 1.2s infinite' : 'none',
                    flexShrink: 0,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {isListening ? <Mic style={{ width: 22, height: 22 }} /> : <MicOff style={{ width: 22, height: 22 }} />}
                </button>

                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: isListening ? '#991b1b' : '#0f172a' }}>
                    {isListening ? 'Listening to your voice... (Tap mic to pause)' : 'Microphone Ready (Tap mic to speak)'}
                  </h4>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                    Describe: emergency type, location/ward, people affected, phone number.
                  </p>
                </div>
              </div>

              {/* Language Pills */}
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[
                  { code: 'en-IN', label: 'EN' },
                  { code: 'hi-IN', label: 'HI' },
                  { code: 'bn-IN', label: 'BN' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: language === lang.code ? 700 : 500,
                      borderRadius: '6px',
                      border: `1px solid ${language === lang.code ? '#059669' : '#cbd5e1'}`,
                      background: language === lang.code ? 'rgba(5, 150, 105, 0.1)' : '#ffffff',
                      color: language === lang.code ? '#059669' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcription Box (Single Clean Div) */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '0.75rem',
              padding: '0.9rem 1.1rem',
              border: '1px solid #e2e8f0',
              fontSize: '0.88rem',
              color: fullDisplayTranscript ? '#0f172a' : '#94a3b8',
              fontStyle: fullDisplayTranscript ? 'normal' : 'italic',
              lineHeight: 1.5,
              minHeight: '65px',
            }}>
              {fullDisplayTranscript || 'Speak your incident details aloud... (e.g. "Accident in Ward 12 Kolkata, 4 injured, need medical team")'}
            </div>

            {/* Extracted Fields Summary Chips */}
            {Object.keys(extractedFields).length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                padding: '0.6rem 0.8rem',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', width: '100%' }}>
                  Auto-Extracted from Speech:
                </span>
                {extractedFields.need_type && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(5, 150, 105, 0.1)', color: '#065f46', padding: '2px 7px', borderRadius: '4px' }}>
                    Need: {extractedFields.need_type.toUpperCase()}
                  </span>
                )}
                {extractedFields.people_affected && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', padding: '2px 7px', borderRadius: '4px' }}>
                    People: {extractedFields.people_affected}
                  </span>
                )}
                {extractedFields.women_count && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(219, 39, 119, 0.1)', color: '#be185d', padding: '2px 7px', borderRadius: '4px' }}>
                    Women: {extractedFields.women_count}
                  </span>
                )}
                {extractedFields.children_count && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(14, 165, 233, 0.1)', color: '#0369a1', padding: '2px 7px', borderRadius: '4px' }}>
                    Children: {extractedFields.children_count}
                  </span>
                )}
                {extractedFields.district && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(217, 119, 6, 0.1)', color: '#b45309', padding: '2px 7px', borderRadius: '4px' }}>
                    District: {extractedFields.district}
                  </span>
                )}
                {extractedFields.ward && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(124, 58, 237, 0.1)', color: '#6d28d9', padding: '2px 7px', borderRadius: '4px' }}>
                    Ward: {extractedFields.ward}
                  </span>
                )}
                {extractedFields.contact_number && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(8, 145, 178, 0.1)', color: '#0e7490', padding: '2px 7px', borderRadius: '4px' }}>
                    Contact: {extractedFields.contact_number}
                  </span>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  baseTranscriptRef.current = '';
                  sessionFinalRef.current = '';
                  transcriptRef.current = '';
                  interimTextRef.current = '';
                  extractedFieldsRef.current = {};
                  setTranscript('');
                  setInterimText('');
                  setExtractedFields({});
                  startVoiceListening();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 0.9rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw style={{ width: 13, height: 13 }} />
                Clear & Re-speak
              </button>

              <button
                type="button"
                onClick={handleProceedToCamera}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 1.4rem',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Camera style={{ width: 16, height: 16 }} />
                Next: Capture Live Photo
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: LIVE CAMERA VIEWFINDER ── */}
        {step === 'camera' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              position: 'relative',
              width: '100%',
              height: '320px',
              background: '#090d16',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* GPS Lock Tag */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                zIndex: 10,
                padding: '6px 12px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
                background: location ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
                border: location ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(245,158,11,0.5)',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 'bold',
                color: location ? '#34d399' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <MapPin style={{ width: 12, height: 12 }} />
                {location ? `GPS LOCKED: ${location.lat}, ${location.lng}` : 'ACQUIRING GPS...'}
              </div>

              {cameraCount >= 2 && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 10,
                    padding: '8px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                  }}
                  title="Switch Camera"
                >
                  <SwitchCamera style={{ width: 18, height: 18 }} />
                </button>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            {/* Shutter & Controls */}
            <div style={{ padding: '1.25rem', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => {
                  killCamera();
                  setCapturedPhoto(null);
                  setLocalSubmitError('');
                  lastSpokenErrorRef.current = '';
                  VoiceFeedback.stop();
                  setStep('voice');
                  startVoiceListening();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 0.9rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
                Back to Voice
              </button>

              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isCapturing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 2rem',
                  background: '#059669',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {isCapturing ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    <span>Processing GPS...</span>
                  </>
                ) : (
                  <>
                    <Camera style={{ width: 18, height: 18 }} />
                    <span>Capture Live Photo</span>
                  </>
                )}
              </button>

              <div style={{ width: '80px' }} />
            </div>
          </div>
        )}

        {/* ── STEP 3: PHOTO PREVIEW & SAY "SUBMIT" ── */}
        {(step === 'submit' || step === 'submitting' || step === 'success') && (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Captured Photo Preview */}
            {capturedPhoto && (
              <div style={{
                position: 'relative',
                width: '100%',
                height: '190px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#090d16',
                border: '1.5px solid #059669',
              }}>
                <img
                  src={capturedPhoto.previewUrl}
                  alt="Captured Evidence"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(16, 185, 129, 0.6)',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                }}>
                  <MapPin style={{ width: 12, height: 12 }} />
                  {capturedPhoto.hasGps ? 'GPS EMBEDDED' : 'PHOTO ATTACHED'}
                </div>
              </div>
            )}

            {/* Voice Submit Listener Pulse Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.1rem',
              borderRadius: '12px',
              background: (step === 'submitting' || isSubmitting)
                ? 'rgba(5, 150, 105, 0.08)'
                : 'linear-gradient(135deg, rgba(5, 150, 105, 0.1), rgba(16, 185, 129, 0.18))',
              border: '1.5px solid #059669',
              gap: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#059669',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 0 5px rgba(5, 150, 105, 0.22)',
                  animation: (step === 'submitting' || isSubmitting) ? 'none' : 'pulse 1.5s infinite',
                }}>
                  {(step === 'submitting' || isSubmitting) ? (
                    <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Mic style={{ width: 22, height: 22 }} />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#065f46' }}>
                      {(step === 'submitting' || isSubmitting) ? 'Submitting Report...' : 'Say "Submit" to Send Form'}
                    </h4>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: '#059669',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}>
                      {(step === 'submitting' || isSubmitting) ? 'Transmitting' : 'Voice Active'}
                    </span>
                  </div>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#334155' }}>
                    {(step === 'submitting' || isSubmitting)
                      ? 'Transmitting verified incident report to emergency teams...'
                      : 'Photo attached! Speak "Submit" aloud into your microphone, or tap Submit below.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Success Banner */}
            {(step === 'success' || localSubmitSuccess || submitSuccess) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#059669',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(5, 150, 105, 0.1)',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
              }}>
                <CheckCircle2 style={{ width: 18, height: 18 }} />
                <span>Report Successfully Submitted!</span>
              </div>
            )}

            {/* Error Banner */}
            {(submitError || localSubmitError) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#dc2626',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
              }}>
                <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>{submitError || localSubmitError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  resetSession();
                  startVoiceListening();
                }}
                disabled={step === 'submitting' || isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.6rem 0.85rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
                Back to Voice
              </button>

              <button
                type="button"
                onClick={() => {
                  setCapturedPhoto(null);
                  setLocalSubmitError('');
                  lastSpokenErrorRef.current = '';
                  VoiceFeedback.stop();
                  if (onApplyData) {
                    onApplyData(extractedFields, null, location);
                  }
                  setStep('camera');
                }}
                disabled={step === 'submitting' || isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.6rem 1rem',
                  background: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw style={{ width: 14, height: 14 }} />
                Retake Photo
              </button>

              <button
                type="button"
                onClick={executeSubmission}
                disabled={step === 'submitting' || isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 1.4rem',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(5, 150, 105, 0.3)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Send style={{ width: 14, height: 14 }} />
                Submit Report Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceVideoAssistantModal;
