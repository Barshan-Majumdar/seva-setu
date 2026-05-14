import { useState, useCallback, useEffect } from 'react';
import exifr from 'exifr';
import api, { pollStatus } from '../services/api';
import {
  clearQueuedNeedSubmission,
  getQueuedNeedSubmissions,
  queueNeedSubmission,
} from '../services/offlineQueue';
import { calculateUrgencyPreview } from '../utils/urgency';

export const useFieldForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    need_type: 'medical',
    ward: '',
    district: '',
    people_affected: '',
    is_disaster_zone: false,
    lat: null,
    lng: null,
    imageFile: null,
  });
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncingQueue, setSyncingQueue] = useState(false);

  const refreshQueuedCount = useCallback(async () => {
    const queued = await getQueuedNeedSubmissions();
    setQueuedCount(queued.length);
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queued = await getQueuedNeedSubmissions();
    if (queued.length === 0) return;

    setSyncingQueue(true);

    for (const item of queued) {
      try {
        const { payload } = item;
        const form = new FormData();
        
        Object.keys(payload).forEach(key => {
          if (key === 'imageFile' && payload[key]) {
            form.append('image', payload[key]);
          } else {
            form.append(key, payload[key]);
          }
        });

        await api.post('/needs', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        await clearQueuedNeedSubmission(item.id);
      } catch (syncError) {
        console.error('Queue sync failed for item:', item.id, syncError);
        const status = syncError.response?.status;
        // If it's a 4xx error (bad request), drop it so it doesn't block the queue forever.
        // If it's a 5xx error, we still keep it and retry later.
        if (status >= 400 && status < 500) {
          await clearQueuedNeedSubmission(item.id);
        }
      }
    }

    await refreshQueuedCount();
    setSyncingQueue(false);
  }, [refreshQueuedCount]);

  useEffect(() => {
    const initQueue = async () => {
      const queued = await getQueuedNeedSubmissions();
      setQueuedCount(queued.length);
      if (navigator.onLine && queued.length > 0) {
        await syncOfflineQueue();
      }
    };
    initQueue();

    const onOnline = async () => {
      setIsOnline(true);
      await syncOfflineQueue();
    };

    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshQueuedCount, syncOfflineQueue]);

  const updateField = useCallback(async (key, value) => {
    setFormData((p) => ({ ...p, [key]: value }));

    // If a photo is added, try to extract GPS coordinates from its metadata (works offline)
    if (key === 'imageFile' && value instanceof File) {
      try {
        const gps = await exifr.gps(value);
        if (gps && gps.latitude && gps.longitude) {
          setFormData(p => ({
            ...p,
            lat: gps.latitude,
            lng: gps.longitude
          }));
          console.log('GPS extracted from photo:', gps.latitude, gps.longitude);
        }
      } catch (err) {
        console.warn('Metadata extraction failed (might be missing GPS):', err);
      }
    }
  }, []);

  const [verificationResult, setVerificationResult] = useState(null);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      need_type: 'medical',
      ward: '',
      district: '',
      people_affected: '',
      is_disaster_zone: false,
      lat: null,
      lng: null,
      imageFile: null,
    });
    setSuccess(false);
    setError('');
    setSuccessMessage('');
    setVerificationResult(null);
  }, []);

  const getLocation = useCallback(() => {
    setLocLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLocLoading(false);
      return;
    }

    // Try to get fresh location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateField('lat', lat);
        updateField('lng', lng);
        
        // Save to "Last Known" memory for offline use
        localStorage.setItem('sevasetu_last_lat', lat);
        localStorage.setItem('sevasetu_last_lng', lng);
        
        setLocLoading(false);
      },
      (err) => {
        console.warn('Live GPS failed, checking memory:', err);
        
        // Fallback: Check localStorage for Last Known Position
        const lastLat = localStorage.getItem('sevasetu_last_lat');
        const lastLng = localStorage.getItem('sevasetu_last_lng');
        
        if (lastLat && lastLng) {
          updateField('lat', parseFloat(lastLat));
          updateField('lng', parseFloat(lastLng));
          setSuccessMessage('Live GPS failed. Used your last known stable position.');
        } else {
          setError('Could not get live or saved location. Please try taking a photo to auto-geotag.');
        }
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }, [updateField]);

  const submitForm = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      // Validation
      if (!formData.need_type) return setError('Please select a need type.');
      if (!formData.title) return setError('Please provide a report headline.');
      if (!formData.district) return setError('Please provide the district name.');
      if (!formData.ward) return setError('Please provide the area/ward name.');

      // Hard GPS requirement only when online. When offline on a laptop, we allow "Estimated" location.
      if (isOnline && (!formData.lat || !formData.lng)) {
        return setError('GPS coordinates are required for real-time spatial matching.');
      }
      
      // If offline and no GPS, we'll use 0,0 and mark it as estimated in the payload
      const hasGPS = formData.lat && formData.lng;
      if (!isOnline && !hasGPS) {
        console.warn('Offline submission without GPS. Using area-based estimation.');
      }

      setLoading(true);
      setError('');
      setSuccessMessage('');
      setVerificationResult(null);

      const form = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'imageFile') {
          if (formData[key]) form.append('image', formData[key]);
        } else {
          form.append(key, formData[key]);
        }
      });

      try {
        if (!navigator.onLine) {
          // Offline mode: queue with image (now supported via IndexedDB Blobs)
          const payload = { ...formData, people_affected: parseInt(formData.people_affected, 10) || 0 };
          await queueNeedSubmission(payload);
          await refreshQueuedCount();
          setSuccess(true);
          setSuccessMessage('Saved offline with photo! Your report will auto-sync when internet returns.');
          return;
        }

        const response = await api.post('/needs', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const needId = response.data.needId;
        setSuccessMessage('Verifying report location and content...');

        // Poll for status until it's no longer 'pending'
        const finalNeed = await pollStatus(
          `/needs/${needId}/status`,
          (data) => data.status !== 'pending'
        );

        if (finalNeed.status === 'rejected') {
          const res = finalNeed.verificationResult;
          setVerificationResult({
            geoTag: res?.geoTag === 'PASSED' ? 'GPS VERIFIED' : 'FAILED',
            aiContent: res?.aiContent || 'FAILED'
          });
          throw { 
            response: { 
              data: { 
                errors: res?.errors || ['Verification failed.'] 
              } 
            } 
          };
        }

        setSuccess(true);
        setSuccessMessage('Report verified and submitted successfully!');
      } catch (err) {
        console.error('Submission error:', err);
        // Surface the detailed verification errors from backend
        const backendErrors = err.response?.data?.errors;
        if (backendErrors && backendErrors.length > 0) {
          setError(backendErrors.join('\n'));
        } else {
          setError(err.response?.data?.message || 'Submission failed. Please check your connection.');
        }
      } finally {
        setLoading(false);
      }
    },
    [formData, refreshQueuedCount]
  );

  const urgencyPreview = calculateUrgencyPreview({
    need_type: formData.need_type,
    people_affected: formData.people_affected,
  });

  const setManualLocation = useCallback((lat, lng) => {
    updateField('lat', lat);
    updateField('lng', lng);
    setSuccessMessage('Location set manually. Note: This will be marked as an estimated position.');
  }, [updateField]);

  return {
    formData,
    loading,
    locLoading,
    success,
    successMessage,
    error,
    verificationResult,
    isOnline,
    queuedCount,
    syncingQueue,
    urgencyPreview,
    updateField,
    resetForm,
    getLocation,
    setManualLocation,
    submitForm,
  };
};
