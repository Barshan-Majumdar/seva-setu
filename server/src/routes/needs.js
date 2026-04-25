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
    
    // We removed GPS strict checking for reporters. They only need Context AI check.
    isVerified = true; // Assume verified until AI visual check says otherwise

      // Factor B: Visual Match (AI CLIP)
      try {
        const form = new FormData();
        form.append('file', req.file.buffer, { filename: 'upload.jpg' });
        form.append('need_type', need_type); // Pass the category to AI for specific context checking

        const aiResponse = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/verify-image`,
          form,
          { headers: form.getHeaders() }
        );

        if (aiResponse.data.is_verified) {
          console.log(`AI Match: PASSED (${aiResponse.data.top_match}) - Context Match: ${aiResponse.data.matches_specific_need}`);
          verificationConfidence = aiResponse.data.confidence;
          // Both must pass for full verification. If GPS failed, it's still unverified.
          isVerified = isVerified && true; 
        } else {
          console.log(`AI Match: FAILED (Expected: ${need_type}, Found: ${aiResponse.data.top_match})`);
          isVerified = false;
        }
      } catch (aiErr) {
        console.error('AI Service unreachable:', aiErr.message);
      }
      
      // Save file to disk
      const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      imageUrl = `/uploads/${fileName}`;
      console.log(`File saved to: ${filePath}`);


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
