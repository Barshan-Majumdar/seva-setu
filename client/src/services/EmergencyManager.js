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

const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000');
const AI_URL = import.meta.env.VITE_AI_URL || (Capacitor.isNativePlatform() ? 'http://10.154.209.193:8000' : 'http://localhost:8000');

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
  async triggerEmergency(triggerType = 'BUTTON', location = null) {
    const clientEventId = uuidv4();
    
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
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          source: 'browser',
          confidence: 0.9
        }),
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

      const response = await fetch(`${API_URL}/api/emergency/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
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
  async enrichEmergencyWithVoice(clientEventId, transcript) {
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
        body: JSON.stringify({ transcript, language: 'en-IN' })
      });

      if (!aiResponse.ok) {
        throw new Error(`AI Service returned ${aiResponse.status}`);
      }

      const enrichmentData = await aiResponse.json();
      console.log('[EmergencyManager] NLP Facts Extracted:', enrichmentData);

      // 2. Submit to Node Server for persistence and Safety Rules
      const serverResponse = await fetch(`${API_URL}/api/emergency/${clientEventId}/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichmentData)
      });

      if (serverResponse.ok) {
        const result = await serverResponse.json();
        console.log('[EmergencyManager] Emergency enriched. Urgency:', result.urgencyScore);
      } else {
        console.warn('[EmergencyManager] Server enrichment failed:', serverResponse.status);
      }
      
    } catch (err) {
      // Enrichment failure is non-fatal. The minimum SOS is already saved.
      console.error('[EmergencyManager] Enrichment failed (SOS is still active):', err.message);
    }
  }
};
