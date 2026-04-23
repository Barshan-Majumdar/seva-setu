const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

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

module.exports = router;
