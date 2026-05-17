import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, X, Check, Loader2, ChevronLeft, MapPin, AlertTriangle } from 'lucide-react';

const CameraWatermark = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); // Use ref so we always have fresh handle

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
      (pos) => setLocation({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6), accuracy: pos.coords.accuracy.toFixed(1) }),
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // 3. Camera — hard kill / start via ref
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

  // Open camera when viewfinder active, kill when photo captured
  useEffect(() => {
    if (!capturedImage) {
      openCamera(facingMode);
    } else {
      killCamera();
    }
    return () => killCamera(); // always cleanup on unmount
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

    // Hidden EXIF metadata injection — NO visual text on the image
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    let gpsInjected = false;

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

        console.log('[Camera] Geotag injected successfully into EXIF.');
        gpsInjected = true;
        setCapturedImage({ file, hasGps: true });
        setIsCapturing(false);
        return;
      }
      // No location available — capture without GPS
      throw new Error('No GPS location available');
    } catch (err) {
      console.warn('[Camera] Capturing without GPS:', err.message);
      canvas.toBlob((blob) => {
        const file = new File([blob], `sevasetu_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImage({ file, hasGps: false });
        setIsCapturing(false);
      }, 'image/jpeg', 0.9);
    }
  };

  const confirmCapture = () => {
    if (capturedImage) {
      // Pass the file and GPS status to the parent
      onCapture(capturedImage.file, capturedImage.hasGps);
    }
  };

  const retryCapture = () => {
    setCapturedImage(null);
  };

  const showSwitchBtn = cameraCount >= 2 && !capturedImage;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Top Bar: Back button (left) + Switch Camera (right, mobile only) ── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
      }}>
        {/* Close / Back — always visible, far from any capture controls */}
        <button
          onClick={onCancel}
          style={{
            padding: '12px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft style={{ width: 24, height: 24 }} />
        </button>

        {/* Switch Camera — only shown on devices with 2+ cameras, hidden on laptops */}
        {showSwitchBtn && (
          <button
            onClick={toggleCamera}
            style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SwitchCamera style={{ width: 24, height: 24 }} />
          </button>
        )}
      </div>

      {/* ── Viewfinder ── */}
      <div style={{
        flex: 1,
        position: 'relative',
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

            {/* GPS VERIFIED / NO GPS tag — Top Left */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
              background: capturedImage.hasGps ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
              border: capturedImage.hasGps ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(239,68,68,0.5)',
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: capturedImage.hasGps ? '#34d399' : '#f87171',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {capturedImage.hasGps
                  ? <MapPin style={{ width: 13, height: 13 }} />
                  : <AlertTriangle style={{ width: 13, height: 13 }} />}
                {capturedImage.hasGps ? 'GPS VERIFIED' : 'NO GPS'}
              </span>
            </div>

            {/* Close / Discard button — Top Right */}
            <button
              onClick={retryCapture}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 25,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X style={{ width: 22, height: 22 }} />
            </button>
          </>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* GPS Lock Info — only shown while viewfinder is active */}
        {!capturedImage && (
          <div style={{
            position: 'absolute',
            bottom: '140px',
            left: '16px',
            right: '16px',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {location ? (
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#34d399' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>● GPS LOCK ACQUIRED</div>
                <div style={{ color: '#fff' }}>LAT: {location.lat}</div>
                <div style={{ color: '#fff' }}>LNG: {location.lng}</div>
              </div>
            ) : (
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', marginBottom: '4px' }}>
                  <AlertTriangle style={{ width: 13, height: 13 }} /> NO GPS SIGNAL
                </div>
                <div style={{ color: '#fff' }}>Capture photo anyway — app will attempt to geotag from file metadata.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Controls ── */}
      <div style={{
        height: '140px',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '24px',
        zIndex: 20,
      }}>
        {capturedImage ? (
          <div style={{ display: 'flex', gap: '32px' }}>
            <button
              onClick={retryCapture}
              style={{
                padding: '14px 28px',
                borderRadius: '9999px',
                background: '#1e293b',
                color: '#fff',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '14px',
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              Retake
            </button>
            <button
              onClick={confirmCapture}
              style={{
                padding: '14px 28px',
                borderRadius: '9999px',
                background: '#10b981',
                color: '#fff',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check style={{ width: 20, height: 20 }} /> Use Photo
            </button>
          </div>
        ) : (
          <button
            onClick={capturePhoto}
            disabled={isCapturing}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '4px solid #10b981',
              background: 'rgba(16,185,129,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Camera style={{ width: 32, height: 32, color: '#34d399' }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraWatermark;
