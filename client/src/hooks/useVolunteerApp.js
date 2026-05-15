/* useVolunteerApp.js - FINAL STABILIZED VERSION */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkInTaskById,
  completeTaskById,
  fetchMyTasks,
  fetchMyVolunteerStats,
  updateAvailability,
  updateMyLocation,
  fetchMyBroadcasts,
  acceptBroadcast,
  rejectBroadcast,
} from '../services/volunteer';
import { pollStatus } from '../services/api';
import { useAuth } from './useAuth';

const toRadians = (deg) => (deg * Math.PI) / 180;

export const haversineKm = (a, b) => {
  if (!a || !b || a.lat === undefined || b.lat === undefined) return 0;
  const R = 6371;
  const dLat = toRadians(Number(b.lat) - Number(a.lat));
  const dLon = toRadians(Number(b.lng) - Number(a.lng));
  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const h = Math.sin(dLat / 2) ** 2 +
            Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const useVolunteerApp = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [availability, setAvailability] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState('');
  const [toast, setToast] = useState(null);
  const [volunteerCoords, setVolunteerCoords] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastBusy, setBroadcastBusy] = useState('');

  const gpsLocked = useRef(false);
  const initialLoadDone = useRef(false);
  const syncingAvailabilityRef = useRef(false);
  const lastUpdatePos = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4800);
  }, []);

  const loadData = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [tasksData, statsData, broadcastsData] = await Promise.all([
        fetchMyTasks(),
        fetchMyVolunteerStats(),
        fetchMyBroadcasts().catch(() => []),
      ]);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setStats(statsData || null);
      setBroadcasts(Array.isArray(broadcastsData) ? broadcastsData : []);
      
      // LOGIC: Only use server coords if GPS hasn't locked AND we have absolutely no state yet
      // GUARD: volunteer_lat/lng may not exist in this query — validate they are real finite numbers
      if (!gpsLocked.current && !initialLoadDone.current && tasksData?.[0]) {
        const firstTask = tasksData[0];
        const sLat = Number(firstTask.volunteer_lat);
        const sLng = Number(firstTask.volunteer_lng);
        if (isFinite(sLat) && isFinite(sLng)) {
          console.log('[GPS] Using server coordinates for initial placement');
          setVolunteerCoords({ lat: sLat, lng: sLng, heading: null, accuracy: 0 });
        }
      }
      
      if (!syncingAvailabilityRef.current) setAvailability(Boolean(statsData?.isAvailable ?? true));
      initialLoadDone.current = true;
    } catch (err) {
      setError('Unable to load volunteer workspace.');
    } finally {
      setLoading(false);
    }
  }, []); // REMOVED [volunteerCoords] to stop state battles

  const pushCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          let { latitude, longitude, heading, accuracy } = pos.coords;

          // Development Override: If accuracy is massive (IP location on PC), snap to Habra test zone.
          if (import.meta.env.DEV && accuracy > 50000) {
            latitude = 22.922; // Habra mock
            longitude = 88.545; // Habra mock
            accuracy = 10;
          }

          const newCoords = { lat: latitude, lng: longitude, heading, accuracy };

          // JITTER FILTER: Ignore shifts smaller than 10 meters (reduced from 15)
          if (lastUpdatePos.current) {
            const drift = haversineKm(newCoords, lastUpdatePos.current);
            if (drift < 0.010) return resolve(lastUpdatePos.current);
          }

          lastUpdatePos.current = newCoords;
          gpsLocked.current = true; // LOCK GPS: stop server poll from overwriting location
          setVolunteerCoords(newCoords);
          await updateMyLocation(newCoords).catch((e) => console.error('[GPS] Update failed:', e));
          resolve(newCoords);
        },
        (err) => {
          console.warn('[GPS] Geolocation error:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }, []);

  const toggleAvailability = useCallback(async () => {
    const next = !availability;
    setAvailability(next);
    syncingAvailabilityRef.current = true;
    try {
      await updateAvailability(next);
      showToast(next ? 'Availability ON' : 'Availability OFF');
    } catch (err) {
      setAvailability(!next);
      showToast('Update failed.', 'error');
    } finally {
      setTimeout(() => { syncingAvailabilityRef.current = false; }, 2000);
    }
  }, [availability, showToast]);

  const checkInTask = useCallback(async (task) => {
    try {
      setBusyTaskId(task.task_id);
      const coords = await pushCurrentLocation();
      await checkInTaskById(task.task_id, coords);
      showToast('Checked in.');
      await loadData();
    } catch (err) {
      showToast('Check-in failed.', 'error');
    } finally {
      setBusyTaskId('');
    }
  }, [loadData, pushCurrentLocation, showToast]);

  const completeTask = useCallback(async (task, imageFile) => {
    try {
      setBusyTaskId(task.task_id);
      const response = await completeTaskById(task.task_id, imageFile, volunteerCoords);
      showToast('Verifying your submission...', 'info');

      // Poll for status until it's no longer 'verifying' or 'assigned/in_progress'
      const finalTask = await pollStatus(
        `/tasks/${task.task_id}/status`,
        (data) => data.status === 'completed' || (data.verificationResult && data.verificationResult.verified === false)
      );

      if (finalTask.status !== 'completed') {
        throw {
          response: {
            data: {
              errors: finalTask.verificationResult?.errors || ['Verification failed.'],
              statusSummary: {
                geoTag: finalTask.verificationResult?.geoTag === 'PASSED' ? 'GPS VERIFIED' : 'FAILED',
                aiContent: finalTask.verificationResult?.aiContent || 'FAILED'
              }
            }
          }
        };
      }

      showToast('Task verified and completed!', 'success');
      await loadData();
    } catch (err) {
      showToast('Verification failed.', 'error');
      throw err; // RE-THROW so VolunteerPage can show detailed errors
    } finally {
      setBusyTaskId('');
    }
  }, [loadData, showToast, volunteerCoords]);

  const distanceCoveredKm = useMemo(() => {
    // Priority: Real-time sum from backend stats
    if (stats?.totalDistanceCovered !== undefined && stats?.totalDistanceCovered !== null) {
      return Number(stats.totalDistanceCovered);
    }
    
    // Fallback: Calculate from currently loaded tasks
    const completed = tasks.filter((t) => t.task_status === 'completed' && t.lat && t.lng);
    let total = 0;
    completed.forEach(t => {
      if (t.check_in_lat && t.check_in_lng) {
        const d = haversineKm({ lat: t.check_in_lat, lng: t.check_in_lng }, { lat: t.lat, lng: t.lng });
        if (d < 300) total += d;
      }
    });
    return total;
  }, [stats, tasks]);

  const acceptBroadcastTask = useCallback(async (needId) => {
    try {
      setBroadcastBusy(needId);
      const result = await acceptBroadcast(needId);
      showToast(result.message || 'Mission accepted!', 'success');
      // Optimistically remove the accepted broadcast and reload
      setBroadcasts(prev => prev.filter(b => b.need_id !== needId));
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to accept mission.';
      showToast(msg, 'error');
    } finally {
      setBroadcastBusy('');
    }
  }, [loadData, showToast]);

  const rejectBroadcastTask = useCallback(async (needId) => {
    try {
      setBroadcastBusy(needId);
      await rejectBroadcast(needId);
      // Optimistically remove from UI
      setBroadcasts(prev => prev.filter(b => b.need_id !== needId));
      showToast('Broadcast dismissed.', 'success');
    } catch (err) {
      showToast('Failed to dismiss broadcast.', 'error');
    } finally {
      setBroadcastBusy('');
    }
  }, [showToast]);

  // --- 3. Memos (Derived Data) ---
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.task_status === 'assigned' || t.task_status === 'in_progress'),
    [tasks]
  );

  useEffect(() => {
    loadData();
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 20000); // 20s while active

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  useEffect(() => {
    if (!availability && activeTasks.length === 0) return;

    // Use watchPosition instead of polling to prevent flickering and use OS-level GPS stabilization
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        let { latitude, longitude, heading, accuracy } = pos.coords;

        // Development Override: If accuracy is massive (IP location on PC),
        // we'll "snap" the volunteer to the Habra testing zone (0.5km from task)
        // so the UI distance calculation works nicely for demonstrations.
        if (import.meta.env.DEV && accuracy > 50000) {
          latitude = 22.922; // Habra mock
          longitude = 88.545; // Habra mock
          accuracy = 10; // Mock high accuracy
        }

        const newCoords = { lat: latitude, lng: longitude, heading, accuracy };

        // JITTER FILTER: Ignore shifts smaller than 10 meters
        if (lastUpdatePos.current) {
          const drift = haversineKm(newCoords, lastUpdatePos.current);
          if (drift < 0.010) return;
        }

        lastUpdatePos.current = newCoords;
        gpsLocked.current = true;
        setVolunteerCoords(newCoords);
        await updateMyLocation(newCoords).catch((e) => console.error('[GPS] Update failed:', e));
      },
      (err) => console.warn('[GPS] Watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [availability, activeTasks.length]);

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
    volunteerCoords,
    broadcasts,
    broadcastBusy,
    acceptBroadcastTask,
    rejectBroadcastTask,
  };
};