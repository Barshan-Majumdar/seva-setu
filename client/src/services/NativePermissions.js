/**
 * NativePermissions — Capacitor permission handler for mobile app.
 * Requests microphone, camera, and location permissions on first launch.
 * Falls back gracefully to browser APIs when running on web.
 */
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

const PERMISSIONS_KEY = 'sevasetu_permissions_requested';

/**
 * Check if we're running inside a native Capacitor app (Android/iOS)
 */
export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Request all critical permissions on first app launch.
 * This should be called from App.jsx on mount.
 */
export async function requestAllPermissions() {
  // Only run on native platforms
  if (!isNativeApp()) {
    console.log('[Permissions] Running on web — using browser permission APIs');
    return requestBrowserPermissions();
  }

  const alreadyRequested = localStorage.getItem(PERMISSIONS_KEY);
  
  const results = {
    camera: 'unknown',
    location: 'unknown',
    microphone: 'unknown'
  };

  try {
    // 1. Camera permission
    const cameraStatus = await Camera.checkPermissions();
    if (cameraStatus.camera !== 'granted') {
      const req = await Camera.requestPermissions({ permissions: ['camera'] });
      results.camera = req.camera;
    } else {
      results.camera = 'granted';
    }
  } catch (err) {
    console.warn('[Permissions] Camera error:', err.message);
    results.camera = 'error';
  }

  try {
    // 2. Location permission
    const locStatus = await Geolocation.checkPermissions();
    if (locStatus.location !== 'granted') {
      const req = await Geolocation.requestPermissions({ permissions: ['location'] });
      results.location = req.location;
    } else {
      results.location = 'granted';
    }
  } catch (err) {
    console.warn('[Permissions] Location error:', err.message);
    results.location = 'error';
  }

  try {
    // 3. Microphone permission (no Capacitor plugin — use Web API)
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream.getTracks().forEach(t => t.stop()); // Release immediately
    results.microphone = 'granted';
  } catch (err) {
    console.warn('[Permissions] Microphone error:', err.message);
    results.microphone = 'denied';
  }

  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({
    ...results,
    requestedAt: new Date().toISOString()
  }));

  console.log('[Permissions] Results:', results);
  return results;
}

/**
 * Browser fallback — request permissions via standard Web APIs
 */
async function requestBrowserPermissions() {
  const results = { camera: 'unknown', location: 'unknown', microphone: 'unknown' };

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream.getTracks().forEach(t => t.stop());
    results.microphone = 'granted';
  } catch { results.microphone = 'denied'; }

  try {
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    results.location = 'granted';
  } catch { results.location = 'denied'; }

  // Camera is requested when the user actually takes a photo
  results.camera = 'deferred';

  return results;
}

/**
 * Check current permission status without requesting
 */
export async function getPermissionStatus() {
  if (!isNativeApp()) {
    return { camera: 'web', location: 'web', microphone: 'web' };
  }

  const results = {};
  
  try {
    const cam = await Camera.checkPermissions();
    results.camera = cam.camera;
  } catch { results.camera = 'unknown'; }

  try {
    const loc = await Geolocation.checkPermissions();
    results.location = loc.location;
  } catch { results.location = 'unknown'; }

  results.microphone = 'check-web-api'; // No native plugin for mic status
  return results;
}
