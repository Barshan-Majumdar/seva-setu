const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/coordinators
 * @desc    Get all whitelisted coordinator emails
 * @access  Private (Coordinator)
 */
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const emails = await prisma.coordinatorEmail.findMany({
      orderBy: { addedAt: 'desc' },
    });
    res.json(emails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/coordinators/stats
 * @desc    Get system-wide stats (total users, etc)
 * @access  Private (Coordinator)
 */
router.get('/stats', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });
    
    // Calculate "General Users" (not coordinator, not volunteer)
    const stats = {
      totalUsers: 0,
      coordinators: 0,
      volunteers: 0,
      others: 0
    };

    counts.forEach(c => {
      if (c.role === 'coordinator') stats.coordinators = c._count.id;
      else if (c.role === 'volunteer') stats.volunteers = c._count.id;
      else stats.others += c._count.id;
    });

    // Total members = everyone except coordinators (users + volunteers + field_workers)
    const totalMembers = stats.volunteers + stats.others;

    // Count pending volunteer requests
    const pendingRequests = await prisma.volunteerRequest.count({
      where: { status: 'pending' },
    });

    res.json({
      totalUsers: totalMembers,
      activeVolunteers: stats.volunteers,
      baseUsers: stats.others,
      pendingVolunteerRequests: pendingRequests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/coordinators
 * @desc    Add a new email to the coordinator whitelist
 * @access  Private (Coordinator)
 */
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  try {
    const existing = await prisma.coordinatorEmail.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return res.status(400).json({ message: 'Email is already a coordinator' });
    }

    const newCoordinator = await prisma.coordinatorEmail.create({
      data: { email: email.toLowerCase() },
    });

    res.status(201).json(newCoordinator);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/coordinators/:id
 * @desc    Remove an email from the coordinator whitelist
 * @access  Private (Coordinator)
 */
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const record = await prisma.coordinatorEmail.findUnique({
      where: { id: req.params.id },
    });
    
    if (!record) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    // Optional: Prevent users from deleting themselves
    if (record.email === req.user.email) {
      return res.status(400).json({ message: 'You cannot remove your own coordinator access' });
    }

    await prisma.coordinatorEmail.delete({
      where: { id: req.params.id },
    });

    // Also downgrade their active user role if they exist in DB
    await prisma.user.updateMany({
      where: { email: record.email },
      data: { role: 'volunteer' },
    });

    res.json({ message: 'Coordinator removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
