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
        v.skills, v.is_available, v.tasks_completed, v.completion_rate,
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
      UPDATE volunteers SET is_available = ${is_available} WHERE user_id = ${req.user.id}::uuid
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
      UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326) WHERE user_id = ${req.user.id}::uuid
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
      SELECT skills, is_available, tasks_completed, completion_rate
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

module.exports = router;
