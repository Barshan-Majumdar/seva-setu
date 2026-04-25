const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/volunteers
 * @desc    List all volunteers
 * @access  Private (Coordinator)
 */
router.get('/', auth, async (req, res) => {
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
    await prisma.$executeRaw`
      UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326), updated_at = now() WHERE user_id = ${req.user.id}::uuid
    `;
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
router.get('/me/stats', auth, async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT skills, 
             is_available as "isAvailable", 
             tasks_completed as "tasksCompleted", 
             completion_rate as "completionRate"
      FROM volunteers
      WHERE user_id = ${req.user.id}::uuid
      LIMIT 1
    `;
    res.json(stats[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/volunteers/me/beacon-offline
 * @desc    Emergency "Go Offline" signal via navigator.sendBeacon (fires on tab/browser close)
 *          sendBeacon sends Content-Type: text/plain, so we parse the body manually.
 */
router.post('/me/beacon-offline', async (req, res) => {
  try {
    // sendBeacon can send either JSON string or plain text
    let userId = null;
    
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        userId = parsed.userId;
      } catch { userId = null; }
    } else if (req.body?.userId) {
      userId = req.body.userId;
    }

    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    await prisma.$executeRaw`
      UPDATE volunteers SET is_available = false, updated_at = now() WHERE user_id = ${userId}::uuid
    `;
    console.log(`[BEACON] Volunteer ${userId} marked OFFLINE (browser closed).`);
    res.json({ message: 'Marked offline' });
  } catch (err) {
    console.error('[BEACON] Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Heartbeat Staleness Sweeper
 * Every 5 minutes, mark any volunteer as unavailable if their last update was > 10 minutes ago.
 * This catches cases where sendBeacon fails (e.g., browser crash, network drop).
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
    }
  } catch (err) {
    console.error('[HEARTBEAT] Sweep error:', err.message);
  }
}, 5 * 60 * 1000); // Every 5 minutes

module.exports = router;
