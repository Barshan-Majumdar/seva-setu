import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, SwitchCamera, X, Check, Loader2, ChevronLeft, MapPin, AlertTriangle,
  Mic, Send, CheckCircle2, RotateCcw
} from 'lucide-react';
import { VoiceFeedback } from '../services/VoiceFeedback';

/**
 * CameraWatermark & Voice Submit Container
 * Opens an interactive div modal where the entire flow continues:
 * 1. Capture live GPS-watermarked photo
 * 2. Review photo preview
 * 3. Listen for user saying "Submit" (or clicking submit)
 * 4. Automatic submission and progress
 */
const CameraWatermark = ({
  onCapture,
  onCancel,
  onSubmit,
  isSubmitting = false,
  submitSuccess = false,
  submitError = ''
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [facingMode, setFacingMode] = useState('environment');
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraCount, setCameraCount] = useState(0);

  // 1. Device Enumeration
  useEffect(() => {
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraCount(devices.filter(d => d.kind === 'videoinput').length);
      } catch { setCameraCount(1); }
    })();
  }, []);

  // 2. GPS — continuous watch
  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocError('Not supported'); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => setLocation({
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        accuracy: pos.coords.accuracy.toFixed(1)
      }),
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // 3. Camera — hardware control
  const killCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      console.log('[Camera] Hardware released.');
    }
  }, []);

  const openCamera = useCallback(async (mode) => {
    killCamera();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      console.error('[Camera] Access error:', err);
    }
  }, [killCamera]);

  useEffect(() => {
    if (!capturedImage) {
      openCamera(facingMode);
    } else {
      killCamera();
    }
    return () => killCamera();
  }, [facingMode, !!capturedImage, openCamera, killCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // 4. Capture & EXIF Injection
  const capturePhoto = async () => {
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

        setCapturedImage({ file, hasGps: true });
        setIsCapturing(false);

        // Notify parent immediately with file and location
        if (onCapture) {
          onCapture(file, true, location);
        }
        return;
      }
      throw new Error('No GPS location available');
    } catch (err) {
      console.warn('[Camera] Capturing without GPS:', err.message);
      canvas.toBlob((blob) => {
        const file = new File([blob], `sevasetu_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImage({ file, hasGps: false });
        setIsCapturing(false);

        if (onCapture) {
          onCapture(file, false, location);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const confirmCapture = () => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage.file, capturedImage.hasGps, location);
    }
    if (onCancel) {
      onCancel();
    }
  };

  const retryCapture = () => {
    setCapturedImage(null);
  };

  // ── Speech Recognition: Listen for "Submit" when photo is captured ──
  useEffect(() => {
    if (!capturedImage || !onSubmit || isSubmitting || submitSuccess) return;

    VoiceFeedback.speak("Photo captured! Say 'Submit' to submit your report.");

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition;
    let isCancelled = false;

    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        const lower = text.toLowerCase().trim();
        console.log('[CameraModal:VoiceSubmit] Heard:', lower);

        // Match English, Hindi, Bengali submit keywords
        if (/\b(submit|jama|bhejo|bhej|pathao|confirm|send)\b/i.test(lower) && !isCancelled) {
          isCancelled = true;
          try { recognition.stop(); } catch (_) {}
          VoiceFeedback.speak('Submitting report now...');
          onSubmit();
        }
      };

      recognition.onerror = (err) => {
        console.warn('[CameraModal:VoiceSubmit] Error:', err?.error);
      };

      recognition.onend = () => {
        if (!isCancelled && !isSubmitting && !submitSuccess) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[CameraModal:VoiceSubmit] Start error:', err);
    }

    return () => {
      isCancelled = true;
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
    };
  }, [!!capturedImage, onSubmit, isSubmitting, submitSuccess]);

  // When submit succeeds, announce and auto-close after 1.5s
  useEffect(() => {
    if (submitSuccess) {
      VoiceFeedback.speak('Report submitted successfully.');
      const t = setTimeout(() => {
        if (onCancel) onCancel();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [submitSuccess, onCancel]);

  const showSwitchBtn = cameraCount >= 2 && !capturedImage;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.72)',
      backdropFilter: 'blur(8px)',
      padding: '1rem',
    }}>
      <div style={{
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
        {/* ── Modal Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'rgba(5, 150, 105, 0.1)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Camera style={{ width: 17, height: 17 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {capturedImage ? 'Live Photo Verified & Ready' : 'Capture Live Photo'}
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                {capturedImage
                  ? onSubmit ? 'Step 2: Say "Submit" to send your report' : 'Photo captured with GPS'
                  : 'Real-time GPS camera evidence'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
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
            title="Close camera"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* ── Viewfinder / Photo Area ── */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '310px',
          background: '#090d16',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {capturedImage ? (
            <>
              <img
                src={URL.createObjectURL(capturedImage.file)}
                alt="Captured"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />

              {/* GPS VERIFIED / NO GPS tag */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
                background: capturedImage.hasGps ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                border: capturedImage.hasGps ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(239,68,68,0.5)',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 'bold',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: capturedImage.hasGps ? '#34d399' : '#f87171',
              }}>
                {capturedImage.hasGps ? <MapPin style={{ width: 12, height: 12 }} /> : <AlertTriangle style={{ width: 12, height: 12 }} />}
                {capturedImage.hasGps ? 'GPS VERIFIED' : 'NO GPS'}
              </div>
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* GPS Lock Info */}
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

              {showSwitchBtn && (
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
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                  }}
                  title="Switch camera"
                >
                  <SwitchCamera style={{ width: 18, height: 18 }} />
                </button>
              )}
            </>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* ── Controls / Voice Submit Flow Inside the SAME div ── */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#ffffff' }}>
          {!capturedImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isCapturing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 2.25rem',
                  background: '#059669',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  fontSize: '0.9rem',
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
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Tap to snap photo with real-time GPS verification
              </span>
            </div>
          ) : onSubmit ? (
            /* ── The entire submit process continues through this SAME div ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.1rem',
                borderRadius: '12px',
                background: isSubmitting
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
                    animation: isSubmitting ? 'none' : 'pulse 1.5s infinite',
                  }}>
                    {isSubmitting ? (
                      <Loader2 style={{ width: 22, height: 22, animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Mic style={{ width: 22, height: 22 }} />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#065f46' }}>
                        {isSubmitting ? 'Submitting Report...' : 'Say "Submit" to Send Form'}
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
                        {isSubmitting ? 'Sending' : 'Voice Active'}
                      </span>
                    </div>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#334155' }}>
                      {isSubmitting
                        ? 'Transmitting verified incident report to emergency teams...'
                        : 'Photo attached! Say "Submit" aloud into your microphone, or tap Submit below.'}
                    </p>
                  </div>
                </div>
              </div>

              {submitSuccess && (
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

              {submitError && (
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
                  <span>{submitError}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={retryCapture}
                  disabled={isSubmitting}
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
                  onClick={confirmCapture}
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1.15rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Check style={{ width: 14, height: 14, color: '#059669' }} />
                  Attach & Continue Form
                </button>

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
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
          ) : (
            /* Fallback when onSubmit is not provided */
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={retryCapture}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retake
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                style={{
                  padding: '0.6rem 1.4rem',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Use Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraWatermark;
