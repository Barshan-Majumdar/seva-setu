const express = require('express');
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const { calculateScore, calculatePriority } = require('../services/scoringService');
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

const { parseVoiceTranscript } = require('../services/voiceFormParser');

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
 * @route   POST /api/needs/parse-voice-form
 * @desc    AI-powered voice form field extractor with word-to-field matching
 * @access  Public / Private
 */
router.post('/parse-voice-form', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const parsedData = await parseVoiceTranscript(transcript);
    return res.json({
      success: true,
      ...parsedData
    });
  } catch (error) {
    console.error('[VoiceParse] Failed to parse voice transcript:', error);
    return res.status(500).json({
      error: 'Failed to process voice transcript',
      details: error.message
    });
  }
});

const ALLOWED_NEED_TYPES = ['medical', 'food', 'shelter', 'accidental', 'rescue', 'education', 'other'];

/**
 * @route   POST /api/needs
 * @desc    Create a new community need with AI Verification
 * @access  Private (Field Worker / Coordinator)
 */
router.post('/', auth, upload.single('image'), async (req, res) => {
  const { 
    title, description, need_type, lat, lng, ward, district, 
    people_affected, children_count, adults_count, pregnant_count, is_disaster_zone 
  } = req.body;
  
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

    // ── 1. Strict Input Validation ──────────────────────────────────────────
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ message: 'Incident title is required and must be at least 3 characters long.' });
    }

    const normalizedNeedType = String(need_type || '').toLowerCase().trim();
    if (!ALLOWED_NEED_TYPES.includes(normalizedNeedType)) {
      return res.status(400).json({ 
        message: `Invalid need_type '${need_type}'. Allowed types: ${ALLOWED_NEED_TYPES.join(', ')}` 
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({ 
        message: 'Valid GPS coordinates are required (latitude between -90 and 90, longitude between -180 and 180).' 
      });
    }

    // Sanitize & reconcile demographic headcounts
    const numChildren = Math.max(0, parseInt(children_count, 10) || 0);
    const numAdults = Math.max(0, parseInt(adults_count, 10) || 0);
    const numPregnant = Math.max(0, parseInt(pregnant_count, 10) || 0);
    const effectiveAdults = Math.max(numAdults, numPregnant);
    const minPeopleFromSubcounts = numChildren + effectiveAdults;
    const parsedPeople = parseInt(people_affected, 10);
    const totalPeople = (!isNaN(parsedPeople) && parsedPeople >= minPeopleFromSubcounts)
      ? parsedPeople
      : Math.max(1, minPeopleFromSubcounts);

    // ── 2. Duplicate Submission Detection (30-second window per user/location) ──
    const recentDuplicate = await prisma.need.findFirst({
      where: {
        reportedBy: req.user.id,
        title: title.trim(),
        status: { notIn: ['archived', 'rejected'] },
        createdAt: { gte: new Date(Date.now() - 30 * 1000) }
      },
      select: { id: true, status: true, urgencyScore: true, priorityLevel: true }
    });

    if (recentDuplicate) {
      return res.status(409).json({
        message: 'Duplicate incident submission detected within 30 seconds. Please check your active reports.',
        needId: recentDuplicate.id,
        status: recentDuplicate.status
      });
    }

    // ── 3. Smart Emergency Priority & Urgency Scoring (0-100 & 1-10) ───────────
    const scoringResult = calculatePriority({
      need_type: normalizedNeedType,
      people_affected: totalPeople,
      children_count: numChildren,
      adults_count: effectiveAdults,
      pregnant_count: numPregnant,
      title: title.trim(),
      description: description || '',
      is_disaster_zone: is_disaster_zone === 'true' || is_disaster_zone === true,
      is_verified: false,
    });

    const { priority_score, urgency_score, priority_level, is_life_threatening, vulnerability_factors } = scoringResult;

    // ── 4. Database Persistence ──────────────────────────────────────────────
    const need = await prisma.$transaction(async (tx) => {
      const createdNeed = await tx.need.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : null,
          needType: normalizedNeedType,
          ward: ward || null,
          district: district || null,
          contactNumber: req.body.contact_number || null,
          peopleAffected: totalPeople,
          urgencyScore: urgency_score,
          isVerified: false,
          isDisasterZone: is_disaster_zone === 'true' || is_disaster_zone === true,
          reportedBy: req.user.id,
          status: 'pending',
        },
      });

      // Set PostGIS location and smart priority attributes
      await tx.$executeRaw`
        UPDATE needs 
        SET location = ST_SetSRID(ST_MakePoint(${parsedLng}::float, ${parsedLat}::float), 4326),
            children_count = ${numChildren}::int,
            adults_count = ${effectiveAdults}::int,
            pregnant_count = ${numPregnant}::int,
            priority_level = ${priority_level},
            vulnerability_factors = ${vulnerability_factors}::text[]
        WHERE id = ${createdNeed.id}::uuid
      `;

      return createdNeed;
    });

    // ── 5. Queue AI Verification Job ─────────────────────────────────────────
    try {
      await aiVerificationQueue.add('verify-incident', {
        type: 'incident',
        id: need.id,
        localPath: req.file.path,
        fileName: req.file.filename,
        metadata: { 
          lat: parsedLat, 
          lng: parsedLng 
        }
      });
    } catch (queueErr) {
      console.warn('[Queue] Could not enqueue AI verification job:', queueErr.message);
    }

    // ── 6. Smart Cache Invalidation ──────────────────────────────────────────
    await redisService.clearCache('/api/needs').catch(() => {});
    await redisService.clearCache('/api/coordinators/stats').catch(() => {});

    // Notify coordinator dashboard instantly
    if (global.io) {
      global.io.emit('need_created', { 
        id: need.id, 
        status: 'pending',
        priority_level,
        urgency_score,
        priority_score
      });
      console.log(`[SOCKET] ✅ need_created emitted → needId: ${need.id}`);
    }

    // Return 202 Accepted with full scoring & triage details
    res.status(202).json({
      message: 'Incident reported and queued for AI verification.',
      needId: need.id,
      status: 'pending',
      priority_score,
      urgency_score,
      priority_level,
      is_life_threatening,
      vulnerability_factors
    });

  } catch (err) {
    console.error('[NEEDS] Report error:', err);
    res.status(500).json({ message: 'Server error while reporting incident.' });
  }
});

/**
 * @route   GET /api/needs/:id/status
 * @desc    Check the verification status & current priority of a report
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
        urgencyScore: true,
        priorityLevel: true,
        vulnerabilityFactors: true,
        rejectionReason: true,
        verificationResult: true,
        imageUrl: true,
        updatedAt: true
      }
    });

    if (!need) return res.status(404).json({ message: 'Report not found' });

    res.json({
      ...need,
      urgency_score: need.urgencyScore,
      priority_level: need.priorityLevel,
      priority_score: Math.round(Number(need.urgencyScore || 0) * 10),
      vulnerability_factors: need.vulnerabilityFactors
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching status' });
  }
});

/**
 * @route   GET /api/needs
 * @desc    Get all needs with filters
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  const { status, district, need_type, min_urgency, priority } = req.query;

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
    if (priority && priority !== 'all') {
      params.push(priority);
      conditions.push(`priority_level = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const needs = await prisma.$queryRawUnsafe(
      `SELECT n.id, n.title, n.description, n.need_type, n.people_affected, 
              n.children_count, n.adults_count, n.pregnant_count, n.priority_level, n.vulnerability_factors,
              n.urgency_score, n.status, n.rejection_reason, n.ward, n.district, n.is_disaster_zone, n.is_verified, n.verification_confidence, n.image_url, n.created_at, n.updated_at,
              ST_X(n.location::geometry) as lng, ST_Y(n.location::geometry) as lat,
              (SELECT COUNT(*)::int FROM broadcast_requests br WHERE br.need_id = n.id AND br.status = 'pending' AND br.expires_at > NOW()) as pending_broadcasts
       FROM needs n
       ${whereClause}
       ORDER BY 
         CASE 
           WHEN n.status IN ('open', 'pending', 'assigned', 'in_progress') THEN 0 
           ELSE 1 
         END ASC,
         CASE n.priority_level 
           WHEN 'High' THEN 1 
           WHEN 'Medium' THEN 2 
           WHEN 'Low' THEN 3 
           ELSE 4 
         END ASC,
         n.urgency_score DESC,
         n.created_at DESC`,
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
      SELECT id, title, description, need_type, people_affected,
             children_count, adults_count, pregnant_count, priority_level, vulnerability_factors,
             urgency_score, status, rejection_reason, ward, district, is_disaster_zone, is_verified, verification_confidence, image_url, created_at, updated_at,
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
      triggerBroadcast(req.params.id).catch(err => {
        console.error('[BROADCAST] Manual trigger failed:', err.message);
      });
    }

    // --- SMART INVALIDATION ---
    await redisService.clearCache('/api/needs').catch(() => {});
    if (status === 'open' || status === 'accepted') {
      await redisService.addToSet('needs_to_rebroadcast', req.params.id).catch(() => {});
    }
    // ──────────────────────────
    
    if (global.io) {
      global.io.emit('need_updated', { id: req.params.id, status });
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/needs/:id/recalculate
 * @desc    Recalculate and persist priority score when incident severity or headcount changes
 * @access  Private (Coordinator / Field Worker)
 */
router.patch('/:id/recalculate', auth, async (req, res) => {
  try {
    const existing = await prisma.need.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        description: true,
        needType: true,
        peopleAffected: true,
        childrenCount: true,
        adultsCount: true,
        pregnantCount: true,
        isDisasterZone: true,
        isVerified: true
      }
    });

    if (!existing) return res.status(404).json({ message: 'Incident not found' });

    const needType = req.body.need_type || existing.needType;
    const children = req.body.children_count !== undefined ? Math.max(0, parseInt(req.body.children_count, 10) || 0) : (existing.childrenCount || 0);
    const adults = req.body.adults_count !== undefined ? Math.max(0, parseInt(req.body.adults_count, 10) || 0) : (existing.adultsCount || 0);
    const pregnant = req.body.pregnant_count !== undefined ? Math.max(0, parseInt(req.body.pregnant_count, 10) || 0) : (existing.pregnantCount || 0);
    const effectiveAdults = Math.max(adults, pregnant);
    const minPeople = children + effectiveAdults;
    const people = req.body.people_affected !== undefined ? Math.max(minPeople, parseInt(req.body.people_affected, 10) || minPeople) : Math.max(minPeople, existing.peopleAffected);
    const isDisaster = req.body.is_disaster_zone !== undefined ? Boolean(req.body.is_disaster_zone) : existing.isDisasterZone;
    const title = req.body.title !== undefined ? req.body.title : existing.title;
    const desc = req.body.description !== undefined ? req.body.description : existing.description;

    const priorityResult = calculatePriority({
      need_type: needType,
      people_affected: people,
      children_count: children,
      adults_count: effectiveAdults,
      pregnant_count: pregnant,
      title: title || '',
      description: desc || '',
      is_disaster_zone: isDisaster,
      is_verified: existing.isVerified
    });

    await prisma.$executeRawUnsafe(
      `UPDATE needs
       SET urgency_score = $1,
           priority_level = $2,
           vulnerability_factors = $3,
           people_affected = $4,
           children_count = $5,
           adults_count = $6,
           pregnant_count = $7,
           updated_at = NOW()
       WHERE id = $8::uuid`,
      priorityResult.urgency_score,
      priorityResult.priority_level,
      priorityResult.vulnerability_factors,
      people,
      children,
      effectiveAdults,
      pregnant,
      req.params.id
    );

    await redisService.clearCache('/api/needs').catch(() => {});
    await redisService.clearCache('/api/coordinators/stats').catch(() => {});

    if (global.io) {
      global.io.emit('need_updated', {
        id: req.params.id,
        urgency_score: priorityResult.urgency_score,
        priority_level: priorityResult.priority_level,
        priority_score: priorityResult.priority_score
      });
    }

    res.json({
      message: 'Priority recalculation successful',
      needId: req.params.id,
      ...priorityResult
    });
  } catch (err) {
    console.error('[RECALCULATE] Error:', err);
    res.status(500).json({ message: 'Server error while recalculating priority', details: err.message });
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
    // --- SMART INVALIDATION ---
    await redisService.clearCache('/api/needs').catch(() => {});
    await redisService.clearCache('/api/coordinators/stats').catch(() => {});
    // ──────────────────────────
    
    if (global.io) {
      global.io.emit('need_updated', { id: req.params.id, status: 'archived' });
    }

    res.json({ message: 'Need archived successfully' });
  } catch (err) {
    console.error('[DELETE /needs/:id]', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

module.exports = router;
