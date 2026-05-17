const express = require('express');
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const cache = require('../middleware/cache');
const redisService = require('../services/redisService');

const router = express.Router();

/**
 * @route   GET /api/volunteers
 * @desc    Get all available volunteers (Coordinator view)
 * @access  Private (Coordinator only)
 */
router.get('/', auth, cache(60), async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const volunteers = await prisma.$queryRaw`
      SELECT
        u.id, u.name, u.email,
        v.skills, v.is_available, v.tasks_completed, v.completion_rate, v.updated_at,
        ST_X(v.location::geometry) as lng,
        ST_Y(v.location::geometry) as lat
      FROM volunteers v
      JOIN users u ON v.user_id = u.id
    `;

    // Merge live coordinates from Redis memory
    const { redis } = redisService;
    if (redis && redis.status === 'ready') {
      for (const vol of volunteers) {
        const livePos = await redis.get(`volunteer_location:${vol.id}`);
        if (livePos) {
          try {
            const { lat, lng } = JSON.parse(livePos);
            vol.lat = lat;
            vol.lng = lng;
          } catch(e){}
        }
      }
    }

    res.json(volunteers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/volunteers/me/availability
 * @desc    Toggle availability
 */
router.patch('/me/availability', auth, async (req, res) => {
  const { is_available } = req.body;

  try {
    await prisma.$executeRaw`
      UPDATE volunteers SET is_available = ${is_available}, updated_at = now() WHERE user_id = ${req.user.id}::uuid
    `;
    
    // Clear cache so coordinator and volunteer see the change immediately
    redisService.clearCache('/api/volunteers').catch(() => {});
    redisService.clearCache('/api/volunteers/me/stats').catch(() => {});
    redisService.clearCache('/api/coordinators/stats').catch(() => {});

    // Broadcast instant availability change via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('volunteer_availability_changed', { id: req.user.id, is_available });
    }
    
    res.json({ message: 'Availability updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/volunteers/me/location
 * @desc    Update volunteer GPS location
 */
router.patch('/me/location', auth, async (req, res) => {
  const { lat, lng } = req.body;

  try {
    const { redis } = redisService;
    if (redis && redis.status === 'ready') {
      // Store live coordinates in Redis with 30-minute expiration
      await redis.set(`volunteer_location:${req.user.id}`, JSON.stringify({ lat, lng }), 'EX', 1800);
      
      // Throttle DB updates: Only write to Postgres once every 10 minutes per volunteer to let NeonDB sleep!
      const lastDbWrite = await redis.get(`volunteer_db_write:${req.user.id}`);
      if (!lastDbWrite) {
        await prisma.$executeRaw`
          UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326), updated_at = now() WHERE user_id = ${req.user.id}::uuid
        `;
        await redis.set(`volunteer_db_write:${req.user.id}`, 'true', 'EX', 600); // 10 minutes
      }
    } else {
      // Fallback to direct DB write if Redis is down
      await prisma.$executeRaw`
        UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326), updated_at = now() WHERE user_id = ${req.user.id}::uuid
      `;
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('volunteer_moved', { id: req.user.id, lat, lng });
    }
    
    res.json({ message: 'Location updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/volunteers/me/stats
 * @desc    Get current volunteer stats
 */
router.get('/me/stats', auth, cache(60), async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      WITH volunteer_data AS (
        SELECT location, skills, is_available, completion_rate, tasks_completed
        FROM volunteers
        WHERE user_id = ${req.user.id}::uuid
      ),
      completed_assignments AS (
        SELECT 
          t.id,
          t.check_in_lat,
          t.check_in_lng,
          n.location as need_location
        FROM tasks t
        JOIN needs n ON t.need_id = n.id
        WHERE t.assigned_volunteer_id = ${req.user.id}::uuid 
          AND (t.status = 'completed' OR t.completed_at IS NOT NULL)
      ),
      resolved_reports AS (
        SELECT id FROM needs
        WHERE reported_by = ${req.user.id}::uuid
          AND status = 'completed'
      )
      SELECT 
        vd.skills, 
        vd.is_available as "isAvailable", 
        vd.tasks_completed as "tasksCompleted",
        (SELECT COUNT(*)::int FROM resolved_reports) as "reportsResolved",
        (vd.tasks_completed + (SELECT COUNT(*)::int FROM resolved_reports)) as "totalImpact",
        vd.completion_rate as "completionRate",
        COALESCE(
          (
            SELECT SUM(
              ST_Distance(
                COALESCE(
                  ST_SetSRID(ST_MakePoint(ca.check_in_lng, ca.check_in_lat), 4326)::geography,
                  vd.location::geography
                ),
                ca.need_location::geography
              ) / 1000.0
            )
            FROM completed_assignments ca
          ),
          0
        )::float as "totalDistanceCovered"
      FROM volunteer_data vd
      LIMIT 1
    `;
    res.json(stats[0] || {
      skills: [], isAvailable: true, tasksCompleted: 0, reportsResolved: 0,
      totalImpact: 0, completionRate: 0, totalDistanceCovered: 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/volunteers/me/beacon-offline
 * @desc    Emergency "Go Offline" signal via navigator.sendBeacon (fires on tab/browser close)
 */
router.post('/me/beacon-offline', async (req, res) => {
  try {
    let userId = null;

    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        userId = parsed.userId;
      } catch { userId = null; }
    } else if (req.body?.userId) {
      userId = req.body.userId;
    }

    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    let dbUserId = userId;
    if (userId.startsWith('user_')) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
      });
      if (user) dbUserId = user.id;
    }

    await prisma.$executeRaw`
      UPDATE volunteers SET is_available = false, updated_at = now() WHERE user_id = ${dbUserId}::uuid
    `;
    
    // Clear cache immediately
    redisService.clearCache('/api/volunteers').catch(() => {});
    redisService.clearCache('/api/coordinators/stats').catch(() => {});
    redisService.clearCache('/api/volunteers/me/stats').catch(() => {});
    
    const io = req.app.get('io') || global.io;
    if (io) {
      io.emit('volunteer_availability_changed', { id: dbUserId, is_available: false });
    }
    
    console.log(`[BEACON] Volunteer ${dbUserId} marked OFFLINE.`);
    res.json({ message: 'Marked offline' });
  } catch (err) {
    console.error('[BEACON] Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Heartbeat Staleness Sweeper
 */
setInterval(async () => {
  try {
    const result = await prisma.$executeRaw`
      UPDATE volunteers 
      SET is_available = false 
      WHERE is_available = true 
        AND updated_at < NOW() - INTERVAL '10 minutes'
    `;
    if (result > 0) {
      console.log(`[HEARTBEAT] Marked ${result} stale volunteer(s) as OFFLINE.`);
      redisService.clearCache('/api/volunteers').catch(() => {});
    }
  } catch (err) {
    console.error('[HEARTBEAT] Sweep error:', err.message);
  }
}, 120 * 60 * 1000); // 120 minutes

module.exports = router;
