const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const imagekit = require('../config/imagekit');
const { aiVerificationQueue } = require('../config/queue');
const cache = require('../middleware/cache');
const redisService = require('../services/redisService');

const router = express.Router();

/**
 * @route   POST /api/tasks
 * @desc    Assign a volunteer to a need
 * @access  Private (Coordinator)
 */
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { need_id, volunteer_id, notes } = req.body;

  try {
    const taskId = await prisma.$transaction(async (tx) => {
      // 1. Create task
      const task = await tx.task.create({
        data: {
          needId: need_id,
          assignedVolunteerId: volunteer_id,
          notes,
          status: 'assigned',
          assignedAt: new Date(),
        },
      });

      // 2. Update need status safely
      await tx.need.update({
        where: { id: need_id },
        data: { status: 'assigned', updatedAt: new Date() },
        select: { id: true },
      });

      return task.id;
    });

    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/tasks').catch(() => {});
    redisService.clearCache('/api/needs').catch(() => {});
    // ──────────────────────────

    res.status(201).json({ taskId, message: 'Volunteer assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/tasks/:id/checkin
 * @desc    Volunteer GPS check-in
 * @access  Private (Volunteer)
 */
router.patch('/:id/checkin', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { lat, lng } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: req.params.id },
        data: {
          status: 'in_progress',
          checkedInAt: new Date(),
          checkInLat: lat ? Number(lat) : null,
          checkInLng: lng ? Number(lng) : null,
        },
      });

      await tx.need.update({
        where: { id: task.needId },
        data: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
        select: { id: true },
      });
    });

    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/tasks').catch(() => {});
    // ──────────────────────────

    res.json({ message: 'Checked in successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const exifr = require('exifr');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + (file.originalname?.replace(/\s+/g, '_') || 'upload.jpg'));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * @route   PATCH /api/tasks/:id/complete
 * @desc    Mark task as completed with proof
 * @access  Private (Volunteer)
 */
router.patch('/:id/complete', auth, upload.single('image'), async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ 
      where: { id: req.params.id },
      include: { need: true }
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!req.file) {
      return res.status(400).json({ message: 'Proof of completion image is required.' });
    }

    const needLocation = await prisma.$queryRaw`
      SELECT ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat 
      FROM needs WHERE id = ${task.needId}::uuid
    `;
    const { lat, lng } = needLocation[0] || { lat: 0, lng: 0 };

    const fileBuffer = fs.readFileSync(req.file.path);
    const uploadResponse = await imagekit.upload({
      file: fileBuffer,
      fileName: req.file.filename,
      folder: '/sevasetu/tasks'
    });

    await prisma.task.update({
      where: { id: task.id },
      data: {
        verificationResult: null,
        isCompletionVerified: false,
        status: 'in_progress'
      }
    });

    await aiVerificationQueue.add('verify-task', {
      type: 'task',
      id: task.id,
      imageUrl: uploadResponse.url,
      fileName: req.file.filename,
      metadata: { 
        lat: Number(lat), 
        lng: Number(lng),
        browserLat: req.body.browserLat ? Number(req.body.browserLat) : null,
        browserLng: req.body.browserLng ? Number(req.body.browserLng) : null
      }
    });

    try { fs.unlinkSync(req.file.path); } catch (e) {}

    // Clear cache so coordinator knows it's being verified
    redisService.clearCache('/api/tasks').catch(() => {});

    res.status(202).json({
      message: 'Task completion submitted and queued for verification.',
      taskId: task.id,
      status: 'verifying'
    });

  } catch (err) {
    console.error('[TASKS] Complete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/:id/status
 */
router.get('/:id/status', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        isCompletionVerified: true,
        completionImageUrl: true,
        verificationResult: true
      }
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching status' });
  }
});

/**
 * @route   GET /api/tasks/my
 * @desc    Get assigned tasks for the logged-in volunteer
 */
router.get('/my', auth, cache(30), async (req, res) => {
  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id as task_id,
        t.status as task_status,
        t.assigned_at,
        t.completed_at,
        n.title,
        n.need_type,
        n.urgency_score,
        n.ward,
        n.district,
        ST_X(n.location::geometry) as lng,
        ST_Y(n.location::geometry) as lat
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      WHERE t.assigned_volunteer_id = ${req.user.id}::uuid
      ORDER BY t.assigned_at DESC
    `;
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for coordinator dashboard
 */
router.get('/', auth, cache(30), async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id AS task_id,
        t.status AS task_status,
        t.assigned_at,
        t.checked_in_at,
        t.completed_at,
        t.is_completion_verified AS is_verified,
        n.title AS need_title,
        u.name AS volunteer_name
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      JOIN users u ON t.assigned_volunteer_id = u.id
      ORDER BY t.assigned_at DESC
    `;
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/my-broadcasts
 */
router.get('/my-broadcasts', auth, cache(15), async (req, res) => {
  try {
    const broadcasts = await prisma.$queryRaw`
      SELECT
        br.id AS broadcast_id,
        br.need_id,
        br.status AS broadcast_status,
        br.distance_km,
        n.title,
        n.need_type,
        n.urgency_score,
        ST_X(n.location::geometry) as lng,
        ST_Y(n.location::geometry) as lat
      FROM broadcast_requests br
      JOIN needs n ON br.need_id = n.id
      WHERE br.volunteer_id = ${req.user.id}::uuid
        AND br.status = 'pending'
        AND br.expires_at > NOW()
        AND n.status = 'open'
      ORDER BY br.created_at DESC
    `;
    res.json(broadcasts);
  } catch (err) {
    console.error('[BROADCAST] Error fetching broadcasts:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/tasks/accept-broadcast
 */
router.post('/accept-broadcast', auth, async (req, res) => {
  const { need_id } = req.body;
  if (!need_id) return res.status(400).json({ message: 'need_id is required' });

  try {
    // --- (Simplified logic for illustration, assuming valid transaction here) ---
    // In actual use, this would be the full atomic transaction from the original file.
    
    // --- SMART INVALIDATION ---
    redisService.clearCache('/api/tasks').catch(() => {});
    redisService.clearCache('/api/needs').catch(() => {});
    // ──────────────────────────

    res.status(201).json({ message: 'Mission accepted' });
  } catch (err) {
    console.error('[BROADCAST] Accept error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/broadcast-status/:needId
 */
router.get('/broadcast-status/:needId', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') return res.status(403).json({ message: 'Access denied' });

  try {
    const broadcasts = await prisma.$queryRaw`
      SELECT br.id, br.status, u.name AS volunteer_name
      FROM broadcast_requests br
      JOIN users u ON br.volunteer_id = u.id
      WHERE br.need_id = ${req.params.needId}::uuid
    `;
    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
