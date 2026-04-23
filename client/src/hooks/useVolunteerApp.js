import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkInTaskById,
  completeTaskById,
  fetchMyTasks,
  fetchMyVolunteerStats,
  updateAvailability,
  updateMyLocation,
} from '../services/volunteer';

const DISTANCE_KEY = 'sevasetu_distance_covered_km';

const toRadians = (deg) => (deg * Math.PI) / 180;

const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getCurrentCoords = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

export const useVolunteerApp = () => {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [availability, setAvailability] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState('');
  const [toast, setToast] = useState(null);
  const [distanceCoveredKm, setDistanceCoveredKm] = useState(() => {
    const saved = Number(localStorage.getItem(DISTANCE_KEY));
    return Number.isFinite(saved) ? saved : 0;
  });

  const lastCoordsRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksData, statsData] = await Promise.all([fetchMyTasks(), fetchMyVolunteerStats()]);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setStats(statsData || null);
      setAvailability(Boolean(statsData?.isAvailable ?? true));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Unable to load volunteer workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, [loadData]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.task_status === 'assigned' || task.task_status === 'in_progress'),
    [tasks]
  );

  const updateDistanceFromCoords = useCallback((coords) => {
    if (lastCoordsRef.current) {
      const delta = haversineKm(lastCoordsRef.current, coords);
      const nextDistance = distanceCoveredKm + delta;
      setDistanceCoveredKm(nextDistance);
      localStorage.setItem(DISTANCE_KEY, String(nextDistance));
    }
    lastCoordsRef.current = coords;
  }, [distanceCoveredKm]);

  const pushCurrentLocation = useCallback(async () => {
    const coords = await getCurrentCoords();
    await updateMyLocation(coords);
    updateDistanceFromCoords(coords);
    return coords;
  }, [updateDistanceFromCoords]);

  useEffect(() => {
    if (activeTasks.length === 0) return undefined;

    const interval = setInterval(() => {
      pushCurrentLocation().catch((err) => {
        console.error('Background location update failed:', err);
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeTasks.length, pushCurrentLocation]);

  const toggleAvailability = async () => {
    const next = !availability;
    setAvailability(next);
    try {
      await updateAvailability(next);
      showToast(next ? 'Availability set to ON' : 'Availability set to OFF');
    } catch (err) {
      console.error(err);
      setAvailability(!next);
      showToast('Failed to update availability.', 'error');
    }
  };

  const checkInTask = async (task) => {
    try {
      setBusyTaskId(task.task_id);
      await pushCurrentLocation();
      await checkInTaskById(task.task_id);
      showToast('Checked in successfully. Task moved to In Progress.');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Could not check in. Please retry.', 'error');
    } finally {
      setBusyTaskId('');
    }
  };

  const completeTask = async (task) => {
    try {
      setBusyTaskId(task.task_id);
      await completeTaskById(task.task_id);
      showToast('Task completed. Great impact!', 'success');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Could not complete task. Please retry.', 'error');
    } finally {
      setBusyTaskId('');
    }
  };

  return {
    loading,
    error,
    tasks,
    stats,
    availability,
    busyTaskId,
    distanceCoveredKm,
    activeTasks,
    toggleAvailability,
    checkInTask,
    completeTask,
    toast,
  };
};
