/**
 * geocodingService.js — Reverse Geocoding & Location Resolution for SevaSetu
 * Resolves GPS coordinates (lat, lng) into detailed District, Area, Ward,
 * and human-readable Address for emergency response and coordinator dashboards.
 */

// Known district centers for proximity fallback when reverse-geocoding service is offline/unreachable
const KNOWN_DISTRICTS = [
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, defaultArea: 'Central Kolkata' },
  { name: 'North 24 Parganas', lat: 22.7212, lng: 88.4828, defaultArea: 'Bidhannagar / Salt Lake' },
  { name: 'South 24 Parganas', lat: 22.1882, lng: 88.3995, defaultArea: 'Baruipur / Jadavpur Suburbs' },
  { name: 'Howrah', lat: 22.5958, lng: 88.2636, defaultArea: 'Howrah Central' },
  { name: 'Hooghly', lat: 22.9038, lng: 88.3966, defaultArea: 'Chinsurah / Serampore' },
  { name: 'Nadia', lat: 23.4710, lng: 88.5565, defaultArea: 'Krishnanagar / Kalyani' },
  { name: 'Paschim Medinipur', lat: 22.4257, lng: 87.3199, defaultArea: 'Midnapore' },
  { name: 'Purba Medinipur', lat: 21.9497, lng: 87.7788, defaultArea: 'Tamluk / Haldia' },
  { name: 'Purba Bardhaman', lat: 23.2324, lng: 87.8615, defaultArea: 'Bardhaman' },
  { name: 'Paschim Bardhaman', lat: 23.6889, lng: 86.9661, defaultArea: 'Asansol / Durgapur' },
  { name: 'Darjeeling', lat: 27.0410, lng: 88.2663, defaultArea: 'Darjeeling Hills' },
  { name: 'Jalpaiguri', lat: 26.5414, lng: 88.7196, defaultArea: 'Jalpaiguri' },
  { name: 'Siliguri', lat: 26.7271, lng: 88.3953, defaultArea: 'Siliguri' },
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090, defaultArea: 'Central Delhi' },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, defaultArea: 'Mumbai City' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, defaultArea: 'Bengaluru Urban' },
];

/**
 * Calculate Euclidean distance squared for fast nearest-neighbor district lookup
 */
function findNearestDistrict(lat, lng) {
  let closest = KNOWN_DISTRICTS[0];
  let minDistance = Infinity;

  for (const d of KNOWN_DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lng - lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = d;
    }
  }

  // If within ~150km of known centers, use the closest known district
  if (minDistance < 1.5) {
    return {
      district: closest.name,
      area: closest.defaultArea,
      fullAddress: `${closest.defaultArea}, ${closest.name}, West Bengal, India`,
      source: 'proximity_centroid'
    };
  }

  return {
    district: 'Unknown District',
    area: 'Emergency Area',
    fullAddress: `Lat: ${Number(lat).toFixed(4)}, Lng: ${Number(lng).toFixed(4)}`,
    source: 'raw_coordinates'
  };
}

/**
 * Reverse-geocode coordinates via OpenStreetMap Nominatim with strict timeout
 */
async function reverseGeocodeCoordinates(lat, lng) {
  if (lat == null || lng == null) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SevaSetu-Emergency/1.0 (humanitarian@sevasetu.org)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data = await response.json();
    const addr = data.address || {};

    // Extract District (state_district, county, district, city, town)
    const district = addr.state_district ||
                     addr.county ||
                     addr.district ||
                     addr.city ||
                     addr.town ||
                     addr.municipality ||
                     'Kolkata';

    // Extract Ward / Neighborhood / Locality
    const area = addr.suburb ||
                 addr.neighbourhood ||
                 addr.residential ||
                 addr.quarter ||
                 addr.road ||
                 addr.hamlet ||
                 addr.village ||
                 district;

    const fullAddress = data.display_name || `${area}, ${district}, West Bengal, India`;

    return {
      district: district.trim(),
      area: area.trim(),
      ward: area.trim(),
      fullAddress,
      city: addr.city || addr.town || addr.municipality || '',
      state: addr.state || 'West Bengal',
      postcode: addr.postcode || '',
      lat: Number(lat),
      lng: Number(lng),
      source: 'nominatim'
    };
  } catch (err) {
    console.warn(`[GeocodingService] Reverse geocode failed for (${lat}, ${lng}):`, err.message);
    return null;
  }
}

/**
 * Master Resolver: Combines reverse geocoding, spoken NLP clues, and fallback
 * @param {Object} params
 * @param {number} [params.lat] - Latitude
 * @param {number} [params.lng] - Longitude
 * @param {string} [params.spokenDistrict] - District mentioned in speech
 * @param {string} [params.spokenArea] - Area/locality mentioned in speech
 * @param {string} [params.spokenLandmark] - Landmark mentioned in speech
 * @returns {Promise<Object>} Resolved location info
 */
async function resolveLocation({ lat, lng, spokenDistrict, spokenArea, spokenLandmark } = {}) {
  let resolved = null;

  // 1. If GPS coordinates are available, attempt reverse geocoding
  if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
    resolved = await reverseGeocodeCoordinates(Number(lat), Number(lng));

    // If reverse geocoding timed out or was offline, use proximity centroid lookup
    if (!resolved) {
      resolved = findNearestDistrict(Number(lat), Number(lng));
    }
  }

  // 2. Overlay or enhance with spoken NLP clues if user explicitly said their location
  const finalDistrict = spokenDistrict?.trim() || resolved?.district || 'Kolkata';
  let finalArea = spokenArea?.trim() || resolved?.area || 'General Area';

  if (spokenLandmark?.trim()) {
    finalArea = `${finalArea} (Near ${spokenLandmark.trim()})`;
  }

  const fullAddress = resolved?.fullAddress || `${finalArea}, ${finalDistrict}, India`;

  return {
    district: finalDistrict,
    area: finalArea,
    ward: finalArea,
    fullAddress,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    source: resolved?.source || (spokenDistrict ? 'spoken_transcript' : 'default_fallback')
  };
}

module.exports = {
  resolveLocation,
  reverseGeocodeCoordinates,
  findNearestDistrict,
};

