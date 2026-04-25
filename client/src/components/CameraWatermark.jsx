import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, X, Check, Loader2, ChevronLeft } from 'lucide-react';

const CameraWatermark = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraCount, setCameraCount] = useState(0); // 0 = unknown, 1 = laptop, 2+ = mobile

  // 1. Device Enumeration — detect how many cameras exist
  useEffect(() => {
    const detectCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setCameraCount(videoInputs.length);
        console.log(`[Camera] Detected ${videoInputs.length} camera(s).`);
      } catch (err) {
        console.warn('[Camera] Device enumeration failed:', err);
        setCameraCount(1); // Assume single camera on failure
      }
    };
    detectCameras();
  }, []);

  // 2. Get GPS Location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6),
            accuracy: pos.coords.accuracy.toFixed(1)
          });
        },
        (err) => {
          setLocError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocError('Geolocation not supported');
    }
  }, []);

  // 3. Camera Lifecycle Management
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async (mode) => {
    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error('[Camera] Error accessing camera:', err);
    }
  }, []);

  useEffect(() => {
    if (!capturedImage) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, !!capturedImage]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // 4. Capture & EXIF Injection
  const capturePhoto = async () => {
    if (!videoRef.current || !location) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Hidden EXIF metadata injection — NO visual text on the image
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    try {
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
      setCapturedImage(file);
      setIsCapturing(false);
    } catch (err) {
      console.error('[Camera] Failed to inject EXIF:', err);
      canvas.toBlob((blob) => {
        const file = new File([blob], `sevasetu_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedImage(file);
        setIsCapturing(false);
      }, 'image/jpeg', 0.9);
    }
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
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
      zIndex: 9999,
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
          <img 
            src={capturedImage instanceof File ? URL.createObjectURL(capturedImage) : capturedImage} 
            alt="Captured" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
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
            ) : locError ? (
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fb7185' }}>
                {locError}. GPS required to capture.
              </div>
            ) : (
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> ACQUIRING SATELLITE LOCK...
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Controls — fixed at bottom, well-separated from top nav ── */}
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
            disabled={!location || isCapturing}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: `4px solid ${location ? '#10b981' : '#475569'}`,
              background: location ? 'rgba(16,185,129,0.2)' : '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: location ? 'pointer' : 'not-allowed',
              opacity: location ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <Camera style={{ width: 32, height: 32, color: location ? '#34d399' : '#64748b' }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraWatermark;
