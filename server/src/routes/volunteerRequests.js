const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/volunteer-requests
 * @desc    Submit a volunteer application
 * @access  Private (User role only)
 */
router.post('/', auth, async (req, res) => {
  // Only 'user' role can apply
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can apply to become volunteers.' });
  }

  const { full_name, contact_details, proof_of_work } = req.body;

  if (!full_name || !contact_details || !proof_of_work) {
    return res.status(400).json({ message: 'All fields are required: full_name, contact_details, proof_of_work.' });
  }

  try {
    // Check for existing pending request
    const existingRequest = await prisma.volunteerRequest.findFirst({
      where: {
        userId: req.user.id,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending application.' });
    }

    const request = await prisma.volunteerRequest.create({
      data: {
        userId: req.user.id,
        fullName: full_name,
        contactDetails: contact_details,
        proofOfWork: proof_of_work,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error('[volunteer-requests] POST error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/volunteer-requests/my-status
 * @desc    Get the current user's application status
 * @access  Private (any authenticated user)
 */
router.get('/my-status', auth, async (req, res) => {
  try {
    const request = await prisma.volunteerRequest.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      return res.json({ status: 'none' });
    }

    res.json({
      status: request.status,
      id: request.id,
      createdAt: request.createdAt,
      reviewNote: request.reviewNote,
    });
  } catch (err) {
    console.error('[volunteer-requests] GET my-status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/volunteer-requests
 * @desc    Get all pending volunteer requests
 * @access  Private (Coordinator only)
 */
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { status } = req.query;

  try {
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = 'pending'; // Default to pending
    }

    const requests = await prisma.volunteerRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('[volunteer-requests] GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/volunteer-requests/:id/approve
 * @desc    Approve a volunteer request & promote user to volunteer
 * @access  Private (Coordinator only)
 */
router.patch('/:id/approve', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const request = await prisma.volunteerRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update request status
      await tx.volunteerRequest.update({
        where: { id: req.params.id },
        data: {
          status: 'approved',
          reviewedBy: req.user.id,
          reviewNote: req.body.review_note || null,
        },
      });

      // 2. Promote user from 'user' to 'volunteer'
      await tx.user.update({
        where: { id: request.userId },
        data: { role: 'volunteer' },
      });

      // 3. Create volunteer record
      await tx.volunteer.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId, skills: [] },
        update: {},
      });
    }, {
      maxWait: 15000,
      timeout: 20000,
    });

    // 4. Invalidate the promoted user's cache so they immediately get the 'volunteer' role
    const promotedUser = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { clerkId: true }
    });
    if (promotedUser && promotedUser.clerkId && global.authCache) {
      global.authCache.delete(promotedUser.clerkId);
    }

    res.json({ message: 'Volunteer application approved. User promoted to volunteer.' });
  } catch (err) {
    console.error('[volunteer-requests] APPROVE error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/volunteer-requests/:id/reject
 * @desc    Reject a volunteer request
 * @access  Private (Coordinator only)
 */
router.patch('/:id/reject', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const request = await prisma.volunteerRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    await prisma.volunteerRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        reviewedBy: req.user.id,
        reviewNote: req.body.review_note || 'Application did not meet requirements.',
      },
    });

    res.json({ message: 'Volunteer application rejected.' });
  } catch (err) {
    console.error('[volunteer-requests] REJECT error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
