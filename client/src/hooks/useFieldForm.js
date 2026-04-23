import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
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
        await api.post('/needs', item.payload);
        await clearQueuedNeedSubmission(item.id);
      } catch (syncError) {
        console.error('Queue sync failed for item:', item.id, syncError);
        break;
      }
    }

    await refreshQueuedCount();
    setSyncingQueue(false);
  }, [refreshQueuedCount]);

  useEffect(() => {
    void getQueuedNeedSubmissions().then((queued) => setQueuedCount(queued.length));

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

  const updateField = useCallback((key, value) => {
    setFormData((p) => ({ ...p, [key]: value }));
  }, []);

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
    });
    setSuccess(false);
    setError('');
    setSuccessMessage('');
  }, []);

  const getLocation = useCallback(() => {
    setLocLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLocLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateField('lat', pos.coords.latitude);
        updateField('lng', pos.coords.longitude);
        setLocLoading(false);
      },
      (err) => {
        console.error('Location error:', err);
        setError('Could not get location. Please enable GPS and allow permissions.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [updateField]);

  const submitForm = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      if (!formData.need_type) return setError('Please select a need type.');
      if (!formData.title) return setError('Please provide a report headline.');
      if (!formData.lat || !formData.lng) return setError('GPS coordinates are required for spatial matching.');

      setLoading(true);
      setError('');
      setSuccessMessage('');

      const payload = {
        ...formData,
        people_affected: parseInt(formData.people_affected, 10) || 0,
      };

      try {
        if (!navigator.onLine) {
          await queueNeedSubmission(payload);
          await refreshQueuedCount();
          setSuccess(true);
          setSuccessMessage('Saved offline. Your report will auto-sync when internet returns.');
          return;
        }

        await api.post('/needs', payload);
        setSuccess(true);
        setSuccessMessage('Report submitted successfully and sent to the coordination system.');
      } catch (err) {
        console.error('Submission error:', err);
        setError(err.response?.data?.message || 'Submission failed. Please check your connection.');
      } finally {
        setLoading(false);
      }
    },
    [formData, refreshQueuedCount]
  );

  const urgencyPreview = calculateUrgencyPreview({
    need_type: formData.need_type,
    people_affected: formData.people_affected,
    is_disaster_zone: formData.is_disaster_zone,
    created_at: new Date(),
  });

  return {
    formData,
    loading,
    locLoading,
    success,
    successMessage,
    error,
    isOnline,
    queuedCount,
    syncingQueue,
    urgencyPreview,
    updateField,
    resetForm,
    getLocation,
    submitForm,
  };
};
