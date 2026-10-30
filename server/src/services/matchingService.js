/**
 * Volunteer Matching Service
 * Compares volunteers against a need based on proximity, skills, and reliability.
 * Handles single available volunteer fast-path (no ranking) and multi-volunteer ranking.
 */

const prisma = require('../config/db');

/**
 * Find matching volunteers for a given need.
 * - If only one volunteer is currently available (or no one is nearby, but one is available elsewhere):
 *   NO ranking formula is applied; that volunteer directly gets the job (match_score: 100).
 * - If multiple volunteers are available:
 *   The ranking formula is applied (Proximity 50%, Skills 30%, Reliability 20%).
 *   New volunteers (0 completed tasks) are granted full baseline reliability so 0% does not lock them out.
 *
 * @param {string} needId - The ID of the community need
 * @returns {Array} List of matching volunteers with scores
 */
const findMatches = async (needId) => {
  // 1. Get need details including location
  const needRows = await prisma.$queryRaw`
    SELECT id, title, need_type,
           ST_X(location::geometry) as lng,
           ST_Y(location::geometry) as lat
    FROM needs
    WHERE id = ${needId}::uuid
  `;

  if (!needRows || needRows.length === 0) throw new Error('Need not found');
  const need = needRows[0];

  const { lat, lng, need_type } = need;
  const hasCoords = lat != null && lng != null;

  // 2. Fetch available volunteers WITHIN 6km radius (if coordinates available)
  let volunteers = [];
  if (hasCoords) {
    volunteers = await prisma.$queryRaw`
      SELECT
        u.id,
        u.name,
        v.skills,
        v.is_available,
        v.completion_rate,
        v.tasks_completed,
        ST_Distance(v.location::geography, ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography) / 1000 AS distance_km
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_available = true
        AND v.location IS NOT NULL
        AND ST_DWithin(v.location::geography, ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography, 6000)
      ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)
      LIMIT 10
    `;
  }

  // 3. Fallback: If no one is nearby available (or no coordinates), fetch ANY currently available volunteer
  // "If only one is currently available and no one is nearby available, that volunteer will get the job"
  if (!volunteers || volunteers.length === 0) {
    volunteers = await prisma.$queryRaw`
      SELECT
        u.id,
        u.name,
        v.skills,
        v.is_available,
        v.completion_rate,
        v.tasks_completed,
        CASE
          WHEN v.location IS NOT NULL AND ${lat}::float IS NOT NULL AND ${lng}::float IS NOT NULL THEN
            ST_Distance(v.location::geography, ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography) / 1000
          ELSE NULL
        END AS distance_km
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_available = true
      LIMIT 10
    `;
  }

  if (!volunteers || volunteers.length === 0) {
    return [];
  }

  // 4. Single volunteer available: NO ranking formula applied, direct allocation
  if (volunteers.length === 1) {
    const single = volunteers[0];
    const distKm = single.distance_km != null ? Number(single.distance_km) : 0;
    return [{
      ...single,
      distance_km: distKm,
      match_score: 100, // Maximum score without ranking calculation
      ranking_applied: false
    }];
  }

  // 5. Multiple volunteers available: Apply ranking formula
  const rankedVolunteers = volunteers.map((v) => {
    let score = 0;

    // A. Proximity (Weight 50%)
    const distKm = v.distance_km != null ? Number(v.distance_km) : 0;
    const proximityScore = Math.max(0, 50 * (1 - distKm / 6));
    score += proximityScore;

    // B. Skill Match (Weight 30%)
    const skills = Array.isArray(v.skills) ? v.skills : [];
    if (skills.includes(need_type)) {
      score += 30;
    }

    // C. Reliability (Weight 20%)
    // New volunteers (0 completed tasks) start with neutral baseline (1.0) so 0% does not lock them out
    const tasksCompleted = Number(v.tasks_completed) || 0;
    const completionRate = Number(v.completion_rate) || 0;
    const effectiveReliability = tasksCompleted === 0 ? 1.0 : completionRate;
    score += effectiveReliability * 20;

    return {
      ...v,
      distance_km: distKm,
      match_score: parseFloat(score.toFixed(2)),
      ranking_applied: true
    };
  });

  // Sort by score descending and take top 5
  return rankedVolunteers
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);
};

/**
 * Find all available volunteers for broadcast dispatch.
 * If volunteers exist within radiusKm, returns those candidates.
 * If no one is nearby available, falls back to ANY currently available volunteer
 * so that a single available volunteer receives the mission.
 *
 * @param {string} needId - The ID of the community need
 * @param {number} radiusKm - Search radius in km (default 6, max 15)
 * @returns {Array} List of volunteer candidates with distance
 */
const findBroadcastCandidates = async (needId, radiusKm = 6) => {
  const cappedRadius = Math.min(Math.max(radiusKm, 1), 15);
  const radiusMeters = cappedRadius * 1000;

  // 1. Get need location
  const needRows = await prisma.$queryRaw`
    SELECT id, title, need_type,
           ST_X(location::geometry) as lng,
           ST_Y(location::geometry) as lat
    FROM needs
    WHERE id = ${needId}::uuid
  `;

  if (!needRows || needRows.length === 0) throw new Error('Need not found');
  const need = needRows[0];
  const { lat, lng } = need;
  const hasCoords = lat != null && lng != null;

  let candidates = [];

  // 2. Find available volunteers within radius (if coords exist)
  if (hasCoords) {
    candidates = await prisma.$queryRaw`
      SELECT
        u.id,
        u.name,
        v.skills,
        ST_Distance(
          v.location::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography
        ) / 1000 AS distance_km
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_available = true
        AND v.location IS NOT NULL
        AND ST_DWithin(
          v.location::geography,
          ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography,
          ${radiusMeters}::float
        )
      ORDER BY v.location <-> ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)
    `;
  }

  // 3. Fallback: If no one is nearby available (or no coords available), find ANY currently available volunteer
  if (!candidates || candidates.length === 0) {
    candidates = await prisma.$queryRaw`
      SELECT
        u.id,
        u.name,
        v.skills,
        CASE
          WHEN v.location IS NOT NULL AND ${lat}::float IS NOT NULL AND ${lng}::float IS NOT NULL THEN
            ST_Distance(
              v.location::geography,
              ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography
            ) / 1000
          ELSE NULL
        END AS distance_km
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_available = true
    `;
  }

  return candidates.map(c => ({
    ...c,
    distance_km: c.distance_km != null ? Number(c.distance_km) : null,
  }));
};

/**
 * Trigger a broadcast for a newly created/verified need.
 * Creates BroadcastRequest records for candidates with a 30-minute window.
 *
 * @param {string} needId - The need to broadcast
 * @param {number} radiusKm - Search radius (default 6)
 * @returns {{ count: number, expiresAt: Date }} Number of volunteers notified and expiration
 */
const triggerBroadcast = async (needId, radiusKm = 6) => {
  const candidates = await findBroadcastCandidates(needId, radiusKm);

  if (candidates.length === 0) {
    console.log(`[BROADCAST] No volunteers found within ${radiusKm}km or available fallback for need ${needId}`);
    return { count: 0, expiresAt: null };
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

  // Bulk create broadcast requests (skip duplicates via unique constraint on needId+volunteerId)
  const created = await Promise.allSettled(
    candidates.map(candidate =>
      prisma.broadcastRequest.create({
        data: {
          needId,
          volunteerId: candidate.id,
          status: 'pending',
          distanceKm: candidate.distance_km,
          expiresAt,
        },
      }).catch(err => {
        if (err.code === 'P2002') return null;
        throw err;
      })
    )
  );

  const successCount = created.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  console.log(`[BROADCAST] 📡 Notified ${successCount} volunteer(s) for need ${needId} (expires: ${expiresAt.toISOString()})`);

  // Invalidate volunteer broadcast caches
  try {
    const redisService = require('./redisService');
    await redisService.clearCache('/api/tasks/my-broadcasts');
  } catch {}

  if (global.io) {
    global.io.emit('broadcast_created', { needId });
  }

  return { count: successCount, expiresAt };
};

module.exports = {
  findMatches,
  findBroadcastCandidates,
  triggerBroadcast,
};
