import { v4 as uuidv4 } from 'uuid';
import localforage from 'localforage';

import { Capacitor } from '@capacitor/core';

// Configure local offline queue
const offlineQueue = localforage.createInstance({
  name: 'SevaSetu',
  storeName: 'emergency_queue'
});

const activeEmergencyStore = localforage.createInstance({
  name: 'SevaSetu',
  storeName: 'active_emergency'
});

// Internal state — not on the exported object to avoid `this` confusion
let _retryInterval = null;
let _prewarmedLocation = null;
let _prewarmedLocationTime = 0;

const API_URL = import.meta?.env?.VITE_API_URL || import.meta?.env?.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';
const AI_URL = import.meta?.env?.VITE_AI_URL || 'http://localhost:8000';

/**
 * Ensure deviceId exists in localStorage (generated once, persisted forever).
 */
function getDeviceId() {
  let deviceId = localStorage.getItem('sevasetu_device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('sevasetu_device_id', deviceId);
  }
  return deviceId;
}

export const EmergencyManager = {
  /**
   * Phase 1: Create deterministic emergency locally before network/AI.
   * This MUST succeed even if network, GPS, and AI are all unavailable.
   */
  prewarmLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          _prewarmedLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            source: 'browser',
            confidence: 0.95
          };
          _prewarmedLocationTime = Date.now();
          console.log('[EmergencyManager] 📍 Location pre-warmed successfully');
        },
        () => {},
        { timeout: 7000, maximumAge: 30000, enableHighAccuracy: true }
      );
    } catch (_) {}
  },

  /**
   * Phase 1: Create deterministic emergency locally before network/AI.
   * This MUST succeed even if network, GPS, and AI are all unavailable.
   */
  async triggerEmergency(triggerType = 'BUTTON', location = null, explicitClientEventId = null) {
    const clientEventId = explicitClientEventId || uuidv4();
    
    const emergencyEvent = {
      clientEventId,
      deviceId: getDeviceId(),
      triggerType,
      triggeredAt: new Date().toISOString(),
      location: location || await this.getBestAvailableLocation(),
      capabilitySnapshot: {
        voice: triggerType === 'VOICE',
        screenOffVoice: false,
        networkType: navigator.connection?.effectiveType || 'unknown'
      },
      status: 'SESSION_PERSISTED'
    };

    // 1. Persist locally FIRST (Room journal equivalent for web)
    await activeEmergencyStore.setItem(clientEventId, emergencyEvent);
    console.log('[EmergencyManager] Saved locally:', clientEventId);

    // 2. Submit minimum SOS (do NOT await — SOS submission must not block the return)
    // Errors are caught inside submitMinimumSOS; they queue to offline retry.
    this.submitMinimumSOS(emergencyEvent);

    return emergencyEvent;
  },

  async getBestAvailableLocation() {
    if (_prewarmedLocation && (Date.now() - _prewarmedLocationTime < 60000)) {
      return _prewarmedLocation;
    }
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            source: 'browser',
            confidence: 0.9
          };
          _prewarmedLocation = loc;
          _prewarmedLocationTime = Date.now();
          resolve(loc);
        },
        () => resolve(null), // Fail silently — GPS failure must NOT block SOS
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  },

  /**
   * Phase 1: Minimum SOS & Offline Queue.
   * This method catches its own errors and queues for retry.
   */
  async submitMinimumSOS(event) {
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }

      let currentUser = null;
      try {
        const rawUser = typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null;
        if (rawUser) currentUser = JSON.parse(rawUser);
      } catch (_) {}

      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

      const payload = {
        clientEventId: event.clientEventId,
        source: event.source || event.triggerType || 'VOICE',
        triggerConfidence: 1.0,
        lat: event.location?.lat,
        lng: event.location?.lng,
        accuracy: event.location?.accuracyMeters || event.location?.accuracy,
        capturedAt: event.triggeredAt,
        locale: (typeof navigator !== 'undefined' && navigator.language) || 'en-IN',
        deviceId: event.deviceId,
        sessionId: event.sessionId,
        location: event.location,
        capabilitySnapshot: event.capabilitySnapshot,
        userId: currentUser?.id || null,
        reportedBy: currentUser?.id || null
      };

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/emergency/trigger`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server rejected SOS: ${response.status}`);
      }

      const data = await response.json();
      console.log('[EmergencyManager] Server ACK:', data);
      
      // Reconcile status locally
      const updated = { ...event, status: data.status || 'INCIDENT_CREATED', serverIncidentId: data.serverIncidentId };
      await activeEmergencyStore.setItem(event.clientEventId, updated);
      
      // Remove from offline queue if it was there
      await offlineQueue.removeItem(event.clientEventId).catch(() => {});
      
    } catch (err) {
      console.warn('[EmergencyManager] SOS failed, queuing for retry:', err.message);
      await offlineQueue.setItem(event.clientEventId, {
        payload: event,
        queuedAt: new Date().toISOString(),
        retryCount: 0
      });
      this._startRetryLoop();
    }
  },

  _startRetryLoop() {
    if (_retryInterval) return;
    _retryInterval = setInterval(async () => {
      if (!navigator.onLine) return;
      
      const keys = await offlineQueue.keys();
      if (keys.length === 0) {
        clearInterval(_retryInterval);
        _retryInterval = null;
        return;
      }

      for (const key of keys) {
        const item = await offlineQueue.getItem(key);
        if (!item) continue;
        
        try {
          await EmergencyManager.submitMinimumSOS(item.payload);
          // submitMinimumSOS removes from queue on success
        } catch (e) {
          item.retryCount = (item.retryCount || 0) + 1;
          await offlineQueue.setItem(key, item);
        }
      }
    }, 10000); // retry every 10s when online
  },

  /**
   * Phase 4: Async Enrichment.
   * Sends transcript to AI service, then forwards extracted facts to the Node server
   * which applies deterministic safety rules.
   * This method is fire-and-forget — failure does NOT affect the minimum SOS.
   */
  async enrichEmergencyWithVoice(clientEventId, transcript, location = null) {
    try {
      if (!transcript || transcript.trim().length === 0) {
        console.warn('[EmergencyManager] Empty transcript, skipping enrichment.');
        return;
      }

      console.log('[EmergencyManager] Sending transcript to NLP:', transcript);
      
      // 1. Call AI Service (Python FastAPI)
      const aiResponse = await fetch(`${AI_URL}/extract-facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript, 
          language: (typeof navigator !== 'undefined' && navigator.language) || 'en-IN' 
        })
      });

      if (!aiResponse.ok) {
        throw new Error(`AI Service returned ${aiResponse.status}`);
      }

      const enrichmentData = await aiResponse.json();
      console.log('[EmergencyManager] NLP Facts Extracted:', enrichmentData);

      // 2. Submit to Node Server for persistence and Safety Rules (attach GPS location & user auth)
      let currentUser = null;
      try {
        const rawUser = typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null;
        if (rawUser) currentUser = JSON.parse(rawUser);
      } catch (_) {}

      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const serverResponse = await fetch(`${API_URL}/api/emergency/${clientEventId}/facts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          ...enrichmentData, 
          factsSeq: 1,
          location,
          userId: currentUser?.id || null,
          reportedBy: currentUser?.id || null
        })
      });

      if (serverResponse.ok) {
        const result = await serverResponse.json();
        console.log('[EmergencyManager] Emergency enriched. Urgency:', result.urgency, 'Need ID:', result.needId);
        
        // Dispatch local event so any open UI / dashboards can instantly update
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sevasetu:need-created', { detail: result }));
        }
        return result;
      } else {
        console.warn('[EmergencyManager] Server enrichment failed:', serverResponse.status);
      }
      
    } catch (err) {
      // Enrichment failure is non-fatal. The minimum SOS is already saved.
      console.error('[EmergencyManager] Enrichment failed (SOS is still active):', err.message);
    }
  },

  async cancelEmergency(clientEventId, reason = 'USER_CANCELLED') {
    if (!clientEventId) return;
    try {
      console.log('[EmergencyManager] Cancelling emergency session:', clientEventId);
      await fetch(`${API_URL}/api/emergency/${clientEventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      }).catch(() => {});
      await activeEmergencyStore.removeItem(clientEventId).catch(() => {});
      await offlineQueue.removeItem(clientEventId).catch(() => {});
    } catch (err) {
      console.warn('[EmergencyManager] Cancellation notice:', err.message);
    }
  }
};
