import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkInTaskById,
  completeTaskById,
  fetchMyTasks,
  fetchMyVolunteerStats,
  updateAvailability,
  updateMyLocation,
} from '../services/volunteer';
import { useAuth } from './useAuth';

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
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

export const useVolunteerApp = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  // --- 1. All State ---
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [availability, setAvailability] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState('');
  const [toast, setToast] = useState(null);
  const [volunteerCoords, setVolunteerCoords] = useState(null);

  // --- 2. Callbacks (Stable) ---
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const initialLoadDone = useRef(false);

  const syncingAvailabilityRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    setError('');
    try {
      const [tasksData, statsData] = await Promise.all([fetchMyTasks(), fetchMyVolunteerStats()]);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setStats(statsData || null);
      
      // Prevent background polling from overwriting local state while the user is toggling
      if (!syncingAvailabilityRef.current) {
        setAvailability(Boolean(statsData?.isAvailable ?? true));
      }
      
      initialLoadDone.current = true;
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Unable to load volunteer workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  const pushCurrentLocation = useCallback(async () => {
    try {
      const coords = await getCurrentCoords();
      setVolunteerCoords(coords);
      await updateMyLocation(coords);
      return coords;
    } catch (err) {
      console.warn('Geolocation failed:', err.message);
      return null;
    }
  }, []);

  const toggleAvailability = useCallback(async () => {
    const next = !availability;
    setAvailability(next);
    syncingAvailabilityRef.current = true;
    try {
      await updateAvailability(next);
      showToast(next ? 'Availability set to ON' : 'Availability set to OFF');
    } catch (err) {
      console.error(err);
      setAvailability(!next);
      showToast('Failed to update availability.', 'error');
    } finally {
      // Allow a 2s grace period for the server to reflect the change before we trust polling again
      setTimeout(() => {
        syncingAvailabilityRef.current = false;
      }, 2000);
    }
  }, [availability, showToast]);

  const checkInTask = useCallback(async (task) => {
    try {
      setBusyTaskId(task.task_id);
      const coords = await pushCurrentLocation();
      await checkInTaskById(task.task_id, coords);
      showToast('Checked in successfully. Task moved to In Progress.');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Could not check in. Please retry.', 'error');
    } finally {
      setBusyTaskId('');
    }
  }, [loadData, pushCurrentLocation, showToast]);

  const completeTask = useCallback(async (task, imageFile) => {
    try {
      setBusyTaskId(task.task_id);
      await completeTaskById(task.task_id, imageFile);
      showToast('Task completed. Great impact!', 'success');
      await loadData();
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setBusyTaskId('');
    }
  }, [loadData, showToast]);

  // --- 3. Memos (Derived Data) ---
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.task_status === 'assigned' || t.task_status === 'in_progress'),
    [tasks]
  );

  const distanceCoveredKm = useMemo(() => {
    const completed = tasks
      .filter((t) => t.task_status === 'completed' && t.lat && t.lng)
      .sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));

    if (completed.length === 0) return 0;

    let total = 0;
    
    // 1. Calculate travel to each task (Check-in Loc -> Task Loc)
    // 2. Calculate travel between tasks (Previous Task Loc -> Next Check-in Loc)
    for (let i = 0; i < completed.length; i++) {
      const task = completed[i];
      const taskLoc = { lat: Number(task.lat), lng: Number(task.lng) };
      
      // Distance from where they checked in to where the task was
      if (task.check_in_lat && task.check_in_lng) {
        const checkInLoc = { lat: Number(task.check_in_lat), lng: Number(task.check_in_lng) };
        total += haversineKm(checkInLoc, taskLoc);
      } else {
        // Fallback for legacy tasks without check-in coords
        total += 0.5; 
      }

      // Distance from previous task to current check-in
      if (i > 0) {
        const prevTask = completed[i - 1];
        const prevLoc = { lat: Number(prevTask.lat), lng: Number(prevTask.lng) };
        if (task.check_in_lat && task.check_in_lng) {
          const currentCheckIn = { lat: Number(task.check_in_lat), lng: Number(task.check_in_lng) };
          total += haversineKm(prevLoc, currentCheckIn);
        }
      }
    }
    
    return total;
  }, [tasks]);

  // --- 4. Effects (Lifecycle) ---
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    loadData();
    // Reduced frequency from 10s to 30s to lower server load on Render
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!availability && activeTasks.length === 0) return;
    pushCurrentLocation().catch(console.error);
    const interval = setInterval(() => {
      pushCurrentLocation().catch(console.error);
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [availability, activeTasks.length, pushCurrentLocation]);

  // --- 5. Browser Close Detection (Beacon "Go Offline" Signal) ---
  useEffect(() => {
    if (!userId) return;

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const beaconUrl = `${API_BASE}/volunteers/me/beacon-offline`;

    const sendOfflineBeacon = () => {
      // navigator.sendBeacon is the ONLY reliable way to send data during page unload
      const blob = new Blob(
        [JSON.stringify({ userId })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(beaconUrl, blob);
      console.log('[BEACON] Sent offline signal for user:', userId);
    };

    // Fires when tab/window is being closed or navigated away
    const handleBeforeUnload = () => {
      if (availability) {
        sendOfflineBeacon();
      }
    };

    // Fires when user switches tabs or minimizes (backup for mobile browsers)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && availability) {
        sendOfflineBeacon();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, availability]);

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
