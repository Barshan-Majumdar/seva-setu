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

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for image uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * @route   POST /api/needs
 * @desc    Create a new community need with AI Verification
 * @access  Private (Field Worker / Coordinator)
 */
router.post('/', auth, upload.single('image'), async (req, res) => {
  const { title, description, need_type, lat, lng, ward, district, people_affected, is_disaster_zone } = req.body;
  
  let isVerified = false;
  let verificationConfidence = 0;
  let imageUrl = null;

  try {
    // --- 1. Trust Layer: Verification Pipeline ---
    // Make visual evidence and GPS mandatory
    if (!req.file) {
      return res.status(400).json({ message: 'Verification Failed: A live photo with GPS data is mandatory to verify your location.' });
    }

    console.log('--- STARTING VERIFICATION PIPELINE ---');
    
    let geoTagPassed = false;
    let aiPassed = false;
    const errors = [];

    // ═══════════════════════════════════════════════════════════
    // STEP 1: EXIF GEO-TAG VERIFICATION (Same as Task Completion)
    // ═══════════════════════════════════════════════════════════
    try {
      const gps = await exifr.gps(req.file.buffer);
      let photoLat = gps?.latitude;
      let photoLng = gps?.longitude;

      console.log(`[GEOTAG-REPORT] EXIF GPS: Lat=${photoLat}, Lng=${photoLng}`);
      console.log(`[GEOTAG-REPORT] Reported GPS: Lat=${lat}, Lng=${lng}`);

      const hasValidGps = typeof photoLat === 'number' && 
                          typeof photoLng === 'number' &&
                          (Math.abs(photoLat) > 0.0001 || Math.abs(photoLng) > 0.0001);

      if (!hasValidGps) {
        console.log(`[GEOTAG-REPORT] ❌ NO VALID GPS DATA IN IMAGE`);
        errors.push('⚠️ GEO-TAG MISSING: This image does not contain GPS metadata. Use the Live Camera feature.');
      } else {
        // Proximity check: is the image GPS close to the reported coordinates?
        const dist = Math.sqrt(
          Math.pow(photoLat - Number(lat), 2) +
          Math.pow(photoLng - Number(lng), 2)
        );
        console.log(`[GEOTAG-REPORT] Distance from reported location: ${dist.toFixed(6)} (~${(dist * 111).toFixed(2)} km)`);

        if (dist > 0.01) { // ~1.1km threshold
          console.log(`[GEOTAG-REPORT] ❌ TOO FAR FROM REPORTED LOCATION`);
          errors.push('⚠️ LOCATION MISMATCH: Photo GPS does not match your reported location.');
        } else {
          console.log(`[GEOTAG-REPORT] ✅ GPS VERIFIED`);
          geoTagPassed = true;
        }
      }
    } catch (exifErr) {
      console.warn('[GEOTAG-REPORT] EXIF read error:', exifErr.message);
      errors.push('⚠️ GEO-TAG ERROR: Could not read metadata from this image.');
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2: AI CONTENT CHECK
    // ═══════════════════════════════════════════════════════════
    try {
      const form = new FormData();
      form.append('file', req.file.buffer, { filename: req.file.originalname || 'upload.jpg' });
      // Send as ISSUE_REGISTRATION so the AI knows this is an incident report
      form.append('upload_type', 'ISSUE_REGISTRATION');

      const headers = form.getHeaders();
      try {
        headers['Content-Length'] = form.getLengthSync();
      } catch (e) { /* ignore */ }

      const aiResponse = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/verify-image`,
        form,
        { headers, timeout: 30000 }
      );

      const aiData = aiResponse.data;
      const confidence = aiData.similarity || 0;

      if (aiData.is_verified) {
        console.log(`[AI-REPORT] ✅ PASSED (${aiData.top_match}) Confidence: ${(confidence * 100).toFixed(1)}%`);
        verificationConfidence = confidence;
        aiPassed = true;
      } else {
        const reason = aiData.reason || `AI detected: "${aiData.top_match}"`;
        console.log(`[AI-REPORT] ❌ FAILED — ${reason}`);
        errors.push(`🔍 AI MISMATCH: ${reason}`);
      }
    } catch (aiErr) {
      const errDetail = aiErr.response
        ? `HTTP ${aiErr.response.status}: ${JSON.stringify(aiErr.response.data)}`
        : aiErr.message;
      console.error('[AI-REPORT] AI Service unreachable:', errDetail);
      // Don't block if AI is down, just mark unverified
    }

    // ═══════════════════════════════════════════════════════════
    // FINAL VERDICT
    // ═══════════════════════════════════════════════════════════
    // COORDINATOR OVERRIDE: If a coordinator is logging this, we trust it more.
    if (req.user.role === 'coordinator') {
      isVerified = true;
      console.log(`[VERIFY] Coordinator Override: Automatically verified.`);
    } else {
      isVerified = geoTagPassed && aiPassed;
    }

    const finalStatus = isVerified ? 'open' : 'rejected';
    const rejectionReason = !isVerified ? errors.join(' | ') : null;

    // Save file to disk
    const fileName = `${Date.now()}-${req.file.originalname?.replace(/\s+/g, '_') || 'capture.jpg'}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, req.file.buffer);
    imageUrl = `/uploads/${fileName}`;
    console.log(`[REPORT] File saved: ${filePath}`);


    // --- 2. Urgency Scoring ---
    const urgency_score = calculateScore({
      need_type,
      people_affected: parseInt(people_affected),
      is_verified: isVerified,
    });

    // --- 3. Database Persistence ---
    const needId = await prisma.$transaction(async (tx) => {
      const need = await tx.need.create({
        data: {
          title,
          description,
          needType: need_type,
          ward,
          district,
          contactNumber: req.body.contact_number || null,
          peopleAffected: parseInt(people_affected),
          urgencyScore: urgency_score,
          isVerified: isVerified,
          verificationConfidence: verificationConfidence,
          imageUrl: imageUrl,
          isDisasterZone: is_disaster_zone === 'true',
          reportedBy: req.user.id,
          status: finalStatus,
          rejectionReason: rejectionReason,
        },
      });

      // Set PostGIS location
      await tx.$executeRaw`
        UPDATE needs SET location = ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326) WHERE id = ${need.id}::uuid
      `;

      return need.id;
    });

    const fullNeeds = await prisma.$queryRaw`
      SELECT id, title, description, need_type, people_affected, urgency_score, status, rejection_reason, ward, district, is_disaster_zone, is_verified, verification_confidence, image_url, created_at, updated_at,
             ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      FROM needs
      WHERE id = ${needId}::uuid
      LIMIT 1
    `;

    // --- 4. Automated Dispatch: Broadcast to nearby volunteers ---
    // Fire-and-forget so the API response is not delayed
    if (isVerified) {
      const { triggerBroadcast } = require('../services/matchingService');
      triggerBroadcast(needId, 6).catch(err => {
        console.error('[BROADCAST] Failed to trigger broadcast:', err.message);
      });
    }

    res.status(201).json(fullNeeds[0]);
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
      triggerBroadcast(req.params.id, 6).catch(err => {
        console.error('[BROADCAST] Manual trigger failed:', err.message);
      });
    }

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

    res.json({ message: 'Need archived successfully' });
  } catch (err) {
    console.error('[DELETE /needs/:id]', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

module.exports = router;
