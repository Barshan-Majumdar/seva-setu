const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post('/register', async (req, res) => {
  const { name, email, password, role, org_id, skills } = req.body;

  try {
    // 1. Check if user exists
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Create user in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: password_hash,
          role,
          orgId: org_id || null,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      // If volunteer, create volunteer record
      if (role === 'volunteer') {
        await tx.volunteer.create({
          data: {
            userId: user.id,
            skills: skills || [],
          },
        });
      }

      return user;
    });

    // 4. Generate JWT
    const token = jwt.sign(
      { id: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'sevasetu_dev_secret_key_2026',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: newUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 2. Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'sevasetu_dev_secret_key_2026',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Return current user's DB profile (id, role, email, name)
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  res.json({
    id: req.user.id,
    role: req.user.role,
    email: req.user.email,
    name: req.user.name,
    isNewUser: req.user.isNewUser || false,
  });
});

/**
 * @route   POST /api/auth/set-role
 * @desc    Set user role (coordinator only, or during initial setup for non-volunteer roles)
 * @access  Private
 * 
 * SECURITY: 'volunteer' role can ONLY be granted through the volunteer application
 * approval flow (/api/volunteer-requests/:id/approve). This prevents bypassing.
 */
router.post('/set-role', auth, async (req, res) => {
  const { role } = req.body;
  if (!['coordinator', 'field_worker'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Volunteer role requires application approval.' });
  }

  // Only coordinators can set roles
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Only coordinators can assign roles.' });
  }

  try {
    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
      select: { id: true, role: true, name: true, email: true },
    });

    console.log(`[auth] Role set for user ${updatedUser.id}: ${role}`);
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
