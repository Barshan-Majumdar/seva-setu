/**
 * Volunteer Matching Service
 * Compares volunteers against a need based on proximity, skills, and reliability.
 */

const prisma = require('../config/db');

/**
 * Find top 3 matching volunteers for a given need
 * @param {string} needId - The ID of the community need
 * @returns {Array} List of ranked volunteers with scores
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

  // 2. Fetch available volunteers WITHIN 6km radius, ordered by proximity
  const volunteers = await prisma.$queryRaw`
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

  // 3. Score each volunteer
  const rankedVolunteers = volunteers.map((v) => {
    let score = 0;

    // A. Proximity (Weight 50%)
    const distKm = Number(v.distance_km) || 0;
    const proximityScore = Math.max(0, 50 * (1 - distKm / 6));
    score += proximityScore;

    // B. Skill Match (Weight 30%)
    const skills = Array.isArray(v.skills) ? v.skills : [];
    if (skills.includes(need_type)) {
      score += 30;
    }

    // C. Reliability (Weight 20%)
    const completionRate = Number(v.completion_rate) || 0;
    score += completionRate * 20;

    return {
      ...v,
      distance_km: distKm,
      match_score: parseFloat(score.toFixed(2)),
    };
  });

  // 4. Sort by score descending and take top 5
  return rankedVolunteers
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);
};

/**
 * Find all available volunteers within a given radius for broadcast dispatch.
 * Unlike findMatches (which ranks top 5), this returns ALL candidates for mass notification.
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

  if (!lat || !lng) throw new Error('Need has no location data');

  // 2. Find all available volunteers within radius
  const candidates = await prisma.$queryRaw`
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

  return candidates.map(c => ({
    ...c,
    distance_km: Number(c.distance_km) || 0,
  }));
};

/**
 * Trigger a broadcast for a newly created/verified need.
 * Creates BroadcastRequest records for all nearby volunteers with a 30-minute window.
 * @param {string} needId - The need to broadcast
 * @param {number} radiusKm - Search radius (default 6)
 * @returns {{ count: number, expiresAt: Date }} Number of volunteers notified and expiration
 */
const triggerBroadcast = async (needId, radiusKm = 6) => {
  const candidates = await findBroadcastCandidates(needId, radiusKm);

  if (candidates.length === 0) {
    console.log(`[BROADCAST] No volunteers found within ${radiusKm}km for need ${needId}`);
    return { count: 0, expiresAt: null };
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

  // Bulk create broadcast requests (skip duplicates via upsert-like logic)
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
        // Silently skip if duplicate (unique constraint on needId+volunteerId)
        if (err.code === 'P2002') return null;
        throw err;
      })
    )
  );

  const successCount = created.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  console.log(`[BROADCAST] 📡 Notified ${successCount} volunteers for need ${needId} (expires: ${expiresAt.toISOString()})`);

  return { count: successCount, expiresAt };
};

module.exports = {
  findMatches,
  findBroadcastCandidates,
  triggerBroadcast,
};
