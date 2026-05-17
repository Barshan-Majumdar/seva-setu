const express = require('express');
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const { calculateScore } = require('../services/scoringService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const exifr = require('exifr');
const axios = require('axios');
const FormData = require('form-data');
const imagekit = require('../config/imagekit');
const { aiVerificationQueue, connection } = require('../config/queue');
const cache = require('../middleware/cache');
const redisService = require('../services/redisService');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for image uploads (streaming to disk to prevent OOM)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + (file.originalname?.replace(/\s+/g, '_') || 'upload.jpg'));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * @route   POST /api/needs
 * @desc    Create a new community need with AI Verification
 * @access  Private (Field Worker / Coordinator)
 */
router.post('/', auth, upload.single('image'), async (req, res) => {
  const { title, description, need_type, lat, lng, ward, district, people_affected, is_disaster_zone } = req.body;
  
  try {
    if (connection.status !== 'ready') {
      return res.status(503).json({ 
        message: 'Background queue is unreachable. Please ensure your local Redis server is running.',
        details: 'Redis connection failed (ECONNREFUSED 127.0.0.1:6379).'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'A live photo with GPS data is mandatory to verify your location.' });
    }

    // --- 1. Initial Urgency Scoring (pre-verification) ---
    const urgency_score = calculateScore({
      need_type,
      people_affected: parseInt(people_affected),
      is_verified: false,
    });

    // --- 2. Database Persistence ---
    const need = await prisma.$transaction(async (tx) => {
      const createdNeed = await tx.need.create({
        data: {
          title,
          description,
          needType: need_type,
          ward,
          district,
          contactNumber: req.body.contact_number || null,
          peopleAffected: parseInt(people_affected),
          urgencyScore: urgency_score,
          isVerified: false,
          isDisasterZone: is_disaster_zone === 'true',
          reportedBy: req.user.id,
          status: 'pending',
        },
      });

      // Set PostGIS location
      await tx.$executeRaw`
        UPDATE needs SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326) WHERE id = ${createdNeed.id}::uuid
      `;

      return createdNeed;
    });

    // --- 3. Queue the AI Verification Job with the local path ---
    await aiVerificationQueue.add('verify-incident', {
      type: 'incident',
      id: need.id,
      localPath: req.file.path,
      fileName: req.file.filename,
      metadata: { 
        lat: lat != null ? Number(lat) : null, 
        lng: lng != null ? Number(lng) : null 
      }
    });

    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/needs').catch(() => {});
    // ──────────────────────────

    // Return 202 Accepted - Frontend will poll for status
    res.status(202).json({
      message: 'Incident reported and queued for AI verification.',
      needId: need.id,
      status: 'pending'
    });

  } catch (err) {
    console.error('[NEEDS] Report error:', err);
    res.status(500).json({ message: 'Server error while reporting incident.' });
  }
});

/**
 * @route   GET /api/needs/:id/status
 * @desc    Check the verification status of a report
 * @access  Private
 */
router.get('/:id/status', auth, async (req, res) => {
  try {
    const need = await prisma.need.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        isVerified: true,
        rejectionReason: true,
        verificationResult: true,
        imageUrl: true
      }
    });

    if (!need) return res.status(404).json({ message: 'Report not found' });

    res.json(need);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching status' });
  }
});

/**
 * @route   GET /api/needs
 * @desc    Get all needs with filters
 * @access  Private
 */
router.get('/', auth, cache(60), async (req, res) => {
  const { status, district, need_type, min_urgency } = req.query;

  try {
    // Build WHERE clauses dynamically
    const conditions = [];
    const params = [];

    if (req.user.role !== 'coordinator') {
      params.push(req.user.id);
      conditions.push(`reported_by = $${params.length}::uuid`);
    }

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
      `SELECT n.id, n.title, n.description, n.need_type, n.people_affected, n.urgency_score, n.status, n.rejection_reason, n.ward, n.district, n.is_disaster_zone, n.is_verified, n.verification_confidence, n.image_url, n.created_at, n.updated_at,
              ST_X(n.location::geometry) as lng, ST_Y(n.location::geometry) as lat,
              (SELECT COUNT(*)::int FROM broadcast_requests br WHERE br.need_id = n.id AND br.status = 'pending' AND br.expires_at > NOW()) as pending_broadcasts
       FROM needs n
       ${whereClause}
       ORDER BY n.urgency_score DESC`,
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
router.get('/heatmap', cache(120), async (req, res) => {
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
      SELECT id, title, description, need_type, people_affected, urgency_score, status, rejection_reason, ward, district, is_disaster_zone, is_verified, verification_confidence, image_url, created_at, updated_at,
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

  const { status, rejection_reason } = req.body;

  try {
    const updateData = { status, updatedAt: new Date() };
    if (status === 'rejected' && rejection_reason) {
      updateData.rejectionReason = rejection_reason;
    } else if (status === 'accepted') {
      updateData.rejectionReason = null;
    }

    await prisma.need.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true }, // Avoid fetching geometry column
    });

    // --- AUTOMATED DISPATCH ---
    // If the status is now 'open', trigger the broadcast (mass dispatch)
    if (status === 'open' || status === 'accepted') {
      const { triggerBroadcast } = require('../services/matchingService');
      triggerBroadcast(req.params.id, 2).catch(err => {
        console.error('[BROADCAST] Manual trigger failed:', err.message);
      });
    }

    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/needs').catch(() => {});
    if (status === 'open' || status === 'accepted') {
      redisService.addToSet('needs_to_rebroadcast', req.params.id).catch(() => {});
    }
    // ──────────────────────────

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
router.get('/:id/matches', auth, cache(60), async (req, res) => {
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

/**
 * @route   DELETE /api/needs/:id
 * @desc    Delete a need (completed or rejected)
 * @access  Private (Coordinator)
 */
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    // Use raw SQL to check status — avoids Prisma crash on PostGIS geometry column
    const rows = await prisma.$queryRaw`
      SELECT id, status FROM needs WHERE id = ${req.params.id}::uuid LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Need not found' });
    }

    const need = rows[0];
    if (need.status !== 'completed' && need.status !== 'rejected') {
      return res.status(400).json({ message: 'Only completed or rejected issues can be deleted.' });
    }

    // Soft delete by marking as archived to preserve historical stats
    await prisma.need.update({
      where: { id: req.params.id },
      data: { status: 'archived', updatedAt: new Date() },
      select: { id: true },
    });

    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/needs').catch(() => {});
    redisService.clearCache('/api/coordinators/stats').catch(() => {});
    // ──────────────────────────

    res.json({ message: 'Need archived successfully' });
  } catch (err) {
    console.error('[DELETE /needs/:id]', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

module.exports = router;
