import { useState, useCallback } from 'react';
import axios from 'axios';

export const useFieldForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    need_type: '',
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

  const updateField = useCallback((key, value) => {
    setFormData((p) => ({ ...p, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      need_type: '',
      ward: '',
      district: '',
      people_affected: '',
      is_disaster_zone: false,
      lat: null,
      lng: null,
    });
    setSuccess(false);
    setError('');
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

  const submitForm = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    if (!formData.need_type) return setError('Please select a need type.');
    if (!formData.title) return setError('Please provide a report headline.');
    if (!formData.lat || !formData.lng) return setError('GPS coordinates are required for spatial matching.');

    setLoading(true);
    setError('');
    
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/needs`, {
        ...formData,
        people_affected: parseInt(formData.people_affected) || 0,
      });
      setSuccess(true);
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.response?.data?.message || 'Submission failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [formData]);

  return {
    formData,
    loading,
    locLoading,
    success,
    error,
    updateField,
    resetForm,
    getLocation,
    submitForm,
  };
};
