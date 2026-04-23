const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { calculateScore } = require('../services/scoringService');

const router = express.Router();

/**
 * @route   POST /api/needs
 * @desc    Create a new community need
 * @access  Private (Field Worker / Coordinator)
 */
router.post('/', auth, async (req, res) => {
  const { title, description, need_type, lat, lng, ward, district, people_affected, is_disaster_zone } = req.body;

  try {
    const urgency_score = calculateScore({
      need_type,
      people_affected,
      is_disaster_zone,
      created_at: new Date(),
    });

    const needId = await prisma.$transaction(async (tx) => {
      const need = await tx.need.create({
        data: {
          title,
          description,
          needType: need_type,
          ward,
          district,
          peopleAffected: people_affected,
          urgencyScore: urgency_score,
          isDisasterZone: is_disaster_zone,
          reportedBy: req.user.id,
          status: 'open',
        },
      });

      // Set PostGIS location
      await tx.$executeRaw`
        UPDATE needs SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326) WHERE id = ${need.id}::uuid
      `;

      return need.id;
    });

    const fullNeed = await prisma.need.findUnique({ where: { id: needId } });
    res.status(201).json(fullNeed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/needs
 * @desc    Get all needs with filters
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  const { status, district, need_type, min_urgency } = req.query;

  try {
    // Build WHERE clauses dynamically
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}::need_status`);
    }
    if (district) {
      params.push(district);
      conditions.push(`district = $${params.length}`);
    }
    if (need_type) {
      params.push(need_type);
      conditions.push(`need_type = $${params.length}::need_type`);
    }
    if (min_urgency) {
      params.push(parseFloat(min_urgency));
      conditions.push(`urgency_score >= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const needs = await prisma.$queryRawUnsafe(
      `SELECT id, title, need_type, urgency_score, status, ward, district, created_at,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
       FROM needs
       ${whereClause}
       ORDER BY urgency_score DESC`,
      ...params
    );

    res.json(needs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/needs/heatmap
 * @desc    Get needs data for heatmap rendering
 */
router.get('/heatmap', async (req, res) => {
  try {
    const data = await prisma.$queryRaw`
      SELECT urgency_score,
             ST_X(location::geometry) as lng,
             ST_Y(location::geometry) as lat
      FROM needs
      WHERE status != 'completed'
    `;

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/needs/:id
 * @desc    Get single need details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const need = await prisma.$queryRaw`
      SELECT *,
             ST_X(location::geometry) as lng,
             ST_Y(location::geometry) as lat
      FROM needs
      WHERE id = ${req.params.id}::uuid
      LIMIT 1
    `;

    if (!need || need.length === 0) return res.status(404).json({ message: 'Need not found' });
    res.json(need[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/needs/:id/status
 * @desc    Update need status
 * @access  Private (Coordinator only)
 */
router.patch('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { status } = req.body;

  try {
    await prisma.need.update({
      where: { id: req.params.id },
      data: { status, updatedAt: new Date() },
    });
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const { findMatches } = require('../services/matchingService');

/**
 * @route   GET /api/needs/:id/matches
 * @desc    Get top 3 matching volunteers for a need
 * @access  Private (Coordinator)
 */
router.get('/:id/matches', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const matches = await findMatches(req.params.id);
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
