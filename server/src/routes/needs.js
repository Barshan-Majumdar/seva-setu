const express = require('express');
const prisma = require('../db');
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
      if (req.file.size < 15000) {
        errors.push('🔍 IMAGE ERROR: The photo appears blank or too small. Please capture a clear photo.');
      }

      const form = new FormData();
      form.append('file', req.file.buffer, { filename: 'upload.jpg' });
      form.append('need_type', need_type);

      const aiResponse = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/verify-image`,
        form,
        { headers: form.getHeaders(), timeout: 20000 }
      );

      if (aiResponse.data.is_verified) {
        console.log(`[AI-REPORT] ✅ PASSED (${aiResponse.data.top_match}) Confidence: ${aiResponse.data.confidence}`);
        verificationConfidence = aiResponse.data.confidence;
        aiPassed = true;
      } else {
        console.log(`[AI-REPORT] ❌ FAILED (Expected: ${need_type}, Found: ${aiResponse.data.top_match})`);
        errors.push(`🔍 AI MISMATCH: The image does not match "${need_type}". AI detected: "${aiResponse.data.top_match}".`);
      }
    } catch (aiErr) {
      console.error('[AI-REPORT] AI Service unreachable:', aiErr.message);
      // Don't block if AI is down, just mark unverified
    }

    // ═══════════════════════════════════════════════════════════
    // FINAL VERDICT
    // ═══════════════════════════════════════════════════════════
    isVerified = geoTagPassed && aiPassed;

    if (errors.length > 0 && !isVerified) {
      console.log(`[VERIFICATION] ❌ REJECTED with ${errors.length} error(s).`);
      return res.status(400).json({
        message: 'Verification Failed',
        errors,
        statusSummary: {
          geoTag: geoTagPassed ? 'PASSED' : 'FAILED',
          aiContent: aiPassed ? 'PASSED' : 'FAILED',
        }
      });
    }

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
          peopleAffected: parseInt(people_affected),
          urgencyScore: urgency_score,
          isVerified: isVerified,
          verificationConfidence: verificationConfidence,
          imageUrl: imageUrl,
          isDisasterZone: is_disaster_zone === 'true',
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

    const fullNeeds = await prisma.$queryRaw`
      SELECT id, title, description, need_type, people_affected, urgency_score, status, ward, district, is_disaster_zone, is_verified, verification_confidence, image_url, created_at, updated_at,
             ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      FROM needs
      WHERE id = ${needId}::uuid
      LIMIT 1
    `;
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
      `SELECT id, title, description, need_type, people_affected, urgency_score, status, ward, district, is_disaster_zone, created_at, updated_at,
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
      SELECT id, title, description, need_type, people_affected, urgency_score, status, ward, district, is_disaster_zone, is_verified, verification_confidence, image_url, created_at, updated_at,
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
      select: { id: true }, // Avoid fetching geometry column
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
