import React, { useState, useRef, useEffect } from 'react';
import { Camera, SwitchCamera, X, Check, Loader2 } from 'lucide-react';

const CameraWatermark = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // Default to back camera
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 1. Get GPS Location
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

  // 2. Camera Management
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode) => {
    stopCamera();
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
      console.error('Error accessing camera:', err);
    }
  };

  useEffect(() => {
    if (!capturedImage) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    
    return () => stopCamera();
  }, [facingMode, !!capturedImage]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // 3. Capture & Watermark
  const capturePhoto = async () => {
    if (!videoRef.current || !location) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    
    // Draw the video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // We NO LONGER draw visual text. We will inject hidden EXIF metadata instead.
    
    // Get the base64 data from canvas
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    try {
      const piexifModule = await import('piexifjs');
      const piexif = piexifModule.default || piexifModule;
      
      // Prepare EXIF GPS tags
      const zeroth = {};
      const exif = {};
      const gps = {};
      
      // Convert decimal lat/lng to EXIF rational format (degrees, minutes, seconds)
      const toRational = (number) => {
        const absolute = Math.abs(number);
        const d = Math.floor(absolute);
        const m = Math.floor((absolute - d) * 60);
        const s = Math.round((absolute - d - m / 60) * 3600 * 100);
        return [[d, 1], [m, 1], [s, 100]];
      };

      // GPS tags from piexifjs constants
      gps[piexif.GPSIFD.GPSLatitudeRef] = parseFloat(location.lat) >= 0 ? 'N' : 'S';
      gps[piexif.GPSIFD.GPSLatitude] = toRational(parseFloat(location.lat));
      gps[piexif.GPSIFD.GPSLongitudeRef] = parseFloat(location.lng) >= 0 ? 'E' : 'W';
      gps[piexif.GPSIFD.GPSLongitude] = toRational(parseFloat(location.lng));
      
      // Add version tag (mandatory for some parsers)
      gps[piexif.GPSIFD.GPSVersionID] = [2, 2, 0, 0];
      
      const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
      const exifStr = piexif.dump(exifObj);
      
      // Inject EXIF into the image data URL
      const newImgData = piexif.insert(exifStr, dataUrl);
      
      // Convert DataURL to Blob/File
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
      console.error('Failed to inject EXIF:', err);
      // Fallback: save without EXIF if injection fails
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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onCancel} className="p-3 bg-white/10 rounded-full text-white backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
        
        {!capturedImage && (
          <button onClick={toggleCamera} className="p-3 bg-white/10 rounded-full text-white backdrop-blur-md">
            <SwitchCamera className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {capturedImage ? (
          <img 
            src={capturedImage instanceof File ? URL.createObjectURL(capturedImage) : capturedImage} 
            alt="Captured" 
            className="w-full h-full object-contain" 
          />
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Hidden Canvas for drawing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* GPS Overlay Preview (While capturing) */}
        {!capturedImage && (
          <div className="absolute bottom-32 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10">
            {location ? (
              <div className="text-xs font-mono text-emerald-400">
                <div className="font-bold mb-1">GPS LOCK ACQUIRED</div>
                <div className="text-white">LAT: {location.lat}</div>
                <div className="text-white">LNG: {location.lng}</div>
              </div>
            ) : locError ? (
              <div className="text-xs font-mono text-rose-400">
                {locError}. GPS required to capture.
              </div>
            ) : (
              <div className="text-xs font-mono text-amber-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> ACQUIRING SATELLITE LOCK...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-32 bg-black flex items-center justify-center pb-8 z-10">
        {capturedImage ? (
          <div className="flex gap-8">
            <button onClick={retryCapture} className="px-6 py-3 rounded-full bg-slate-800 text-white font-bold uppercase tracking-wider text-sm border border-slate-700">
              Retake
            </button>
            <button onClick={confirmCapture} className="px-6 py-3 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <Check className="w-5 h-5" /> Use Photo
            </button>
          </div>
        ) : (
          <button 
            onClick={capturePhoto}
            disabled={!location || isCapturing}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
              location ? 'border-emerald-500 bg-emerald-500/20 active:bg-emerald-500 active:scale-95' : 'border-slate-600 bg-slate-800 opacity-50'
            }`}
          >
            <Camera className={`w-8 h-8 ${location ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraWatermark;
